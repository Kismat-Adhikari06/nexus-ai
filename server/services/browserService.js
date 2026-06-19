const { chromium } = require('playwright');

const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-infobars',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--remote-debugging-port=0',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ─── Anti-bot stealth init script ───────────────────────────────────────────
// Injected into every page before any site JS runs to mask headless browser
// signals and make automation harder to detect.
const STEALTH_INIT_SCRIPT = () => {
  // 1. Hide webdriver flag (most common check)
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // 2. Populate plugins array (headless Chrome reports 0, real has several)
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' },
    ],
  });

  // 3. Set realistic language preferences
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // 4. Mock permissions.query to avoid automation detection
  const originalQuery = navigator.permissions.query;
  navigator.permissions.query = (params) => (
    params.name === 'notifications'
      ? Promise.resolve({ state: 'prompt', onchange: null })
      : originalQuery(params)
  );

  // 5. Mock chrome.runtime for sites that check for it
  if (!window.chrome) window.chrome = {};
  if (!window.chrome.runtime) window.chrome.runtime = {};

  // 6. Spoof WebGL vendor/renderer to mask headless GPU
  const getParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (param) {
    if (param === 37445) return 'Intel Inc.';            // UNMASKED_VENDOR_WEBGL
    if (param === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
    return getParam.call(this, param);
  };
};

// ─── Random delay helpers for human-like interaction ────────────────────────
function randomDelay(min = 20, max = 70) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

let browser = null;
let page = null;
let context = null;
let pageListenerAttached = false;

// ─── Operation mutex ─────────────────────────────────────────────────────────
let operationQueue = Promise.resolve();

function withLock(fn) {
  const result = operationQueue.then(async () => await fn());
  operationQueue = result.catch(() => {});
  return result;
}

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  return browser;
}

function attachPageListener(ctx) {
  if (pageListenerAttached) return;
  pageListenerAttached = true;
  ctx.on('page', async (newPage) => {
    page = newPage;
    try {
      await newPage.waitForLoadState('domcontentloaded');
      await newPage.addInitScript(STEALTH_INIT_SCRIPT);
    } catch {
      // page might close before fully loading
    }
  });
}

async function getPage() {
  const b = await getBrowser();
  if (page && !page.isClosed()) return page;
  const contexts = b.contexts();
  if (contexts.length > 0) {
    context = contexts[0];
    attachPageListener(context);
    const pages = context.pages();
    if (pages.length > 0) {
      page = pages[pages.length - 1];
      await page.addInitScript(STEALTH_INIT_SCRIPT);
      return page;
    }
  }
  context = await b.newContext({
    bypassCSP: true,
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  attachPageListener(context);
  page = await context.newPage();
  await page.addInitScript(STEALTH_INIT_SCRIPT);
  return page;
}

// ─── URL validation ──────────────────────────────────────────────────────────
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try { new URL(url); return true; }
  catch { return false; }
}

const URL_SCHEME = /^https?:\/\//i;

async function navigate(url) {
  if (!url || typeof url !== 'string') {
    return 'Error: No URL provided. Usage: navigate("https://example.com")';
  }
  if (!URL_SCHEME.test(url)) url = 'https://' + url;
  if (!isValidUrl(url)) {
    return `Error: Invalid URL "${url}". Please provide a valid URL like "https://example.com" or "localhost:3001".`;
  }
  const p = await getPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait for network idle so heavy SPA sites (Notion, etc.) have time to
  // render their JavaScript-driven content before we try to extract text.
  await p.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {
    console.log('Network idle timed out, proceeding with current state.');
  });

  return `Navigated to ${url}`;
}

async function getText() {
  const p = await getPage();
  return await p.evaluate(() => {
    const paras = Array.from(document.querySelectorAll('p')).filter(p => p.innerText.trim().length > 20);
    if (paras.length > 0) return paras.map(p => p.innerText.trim()).join('\n\n');
    const main = document.querySelector('article') || document.querySelector('main') || document.querySelector('#mw-content-text') || document.querySelector('#content') || document.querySelector('#main-content');
    if (main) return main.innerText;
    return document.body.innerText;
  });
}

// ─── Smart page summary (handles multiple layouts) ─────────────────────────
// First tries <p> tags (blogs, news articles).
// If too few, tries table rows (Hacker News-style listings).
// Then tries common content containers.
// Falls back to body.innerText truncated intelligently.
async function getPageSummary(maxParagraphs = 5, maxChars = 3000) {
  const p = await getPage();
  return await p.evaluate(({ maxParagraphs, maxChars }) => {
    const title = document.title || '';
    const firstHeading = document.querySelector('h1')?.innerText?.trim() || '';

    // ── Strategy 1: <p> tags (blogs, news, docs) ──
    let paras = Array.from(document.querySelectorAll('p'))
      .filter(p => p.innerText.trim().length > 20);

    let items = paras.map(p => p.innerText.trim());
    let source = 'paragraphs';

    // ── Strategy 2: Table rows with links (HN-style listings) ──
    if (items.length < 3) {
      const tableRows = Array.from(document.querySelectorAll('tr.athing, tr.item'));
      if (tableRows.length > 0) {
        items = tableRows.map(tr => {
          const titleLink = tr.querySelector('td.title a, a.storylink, a.title');
          const site = tr.querySelector('.sitebit a, .sitestr');
          if (titleLink) {
            const t = titleLink.innerText.trim();
            const s = site ? ' (' + site.innerText.trim() + ')' : '';
            return t + s;
          }
          return tr.innerText.trim();
        }).filter(t => t.length > 10);
        source = 'results';
      }
    }

    // ── Strategy 3: Common content containers ──
    if (items.length < 3) {
      const containers = ['article', 'main', '[role="main"]', '.post', '.entry', '.content', '#content', '#main', '#mw-content-text', '#main-content'];
      for (const sel of containers) {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.innerText.trim();
          if (text.length > 100) {
            items = [text];
            source = 'content';
            break;
          }
        }
      }
    }

    // ── Strategy 4: Collect from heading + sibling pairs ──
    if (items.length < 3) {
      const sections = Array.from(document.querySelectorAll('h2, h3, h4, strong, b'));
      items = sections.map(h => {
        let text = h.innerText.trim();
        let next = h.nextElementSibling;
        if (next && next.innerText.trim().length > 20) {
          text += ': ' + next.innerText.trim().substring(0, 200);
        }
        return text;
      }).filter(t => t.length > 15);
      source = 'sections';
    }

    // ── Strategy 5: Anything substantial from body ──
    if (items.length < 3) {
      const allText = document.body.innerText.trim();
      items = allText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 30)
        .slice(0, maxParagraphs * 3);
      source = 'text';
    }

    // ── Build result ──
    let result = '';
    if (title) result += `Title: ${title}\n`;
    if (firstHeading && firstHeading !== title) result += `Heading: ${firstHeading}\n`;
    if (result) result += '\n';

    const selected = items.slice(0, maxParagraphs);
    const joiner = source === 'results' ? '\n' : '\n\n';
    result += selected.join(joiner);

    const truncatedByChars = result.length > maxChars;
    if (truncatedByChars) result = result.substring(0, maxChars) + '...';

    const hasMore = items.length > maxParagraphs;
    if (hasMore || truncatedByChars) {
      const remaining = hasMore ? items.length - maxParagraphs : items.length;
      const label = source === 'results' ? 'items' : 'paragraphs';
      result += `\n\n[... ${remaining} more ${label} available. Use browser_get_text for the full page text, or browser_snapshot to interact with elements.]`;
    }

    return result || 'Page has no readable content.';
  }, { maxParagraphs, maxChars });
}

// ─── DuckDuckGo-specific search results extractor ──────────────────────────
async function getSearchResultsSummary(maxResults = 8) {
  const p = await getPage();
  return await p.evaluate((maxResults) => {
    const title = document.title || '';
    let result = '';
    if (title) result += `Title: ${title}\n\n`;

    const articles = Array.from(document.querySelectorAll('article[data-testid="result"], article.result, .results article, .result'));
    if (articles.length > 0) {
      const selected = articles.slice(0, maxResults);
      selected.forEach((article, i) => {
        const heading = article.querySelector('h2, h3')?.innerText?.trim() || '';
        const snippet = article.querySelector('.result__snippet, .snippet, p')?.innerText?.trim() || '';
        const link = article.querySelector('a')?.href || '';
        if (heading) {
          result += `${i + 1}. ${heading}\n`;
          if (snippet) result += `   ${snippet}\n`;
          if (link) result += `   → ${link}\n`;
          result += '\n';
        }
      });
      if (result.length > 3000) result = result.substring(0, 3000) + '...';
      return result || 'No search results found.';
    }

    const headings = Array.from(document.querySelectorAll('h2, h3, h4')).filter(h => {
      const p = h.closest('article') || h.parentElement;
      return p && p.innerText.trim().length > 30;
    });
    if (headings.length > 0) {
      const selected = headings.slice(0, maxResults);
      selected.forEach((h, i) => {
        const parent = h.closest('article') || h.parentElement;
        const text = parent ? parent.innerText.trim() : h.innerText.trim();
        result += `${i + 1}. ${text.substring(0, 500)}\n\n`;
      });
      return result;
    }

    const paras = Array.from(document.querySelectorAll('p'))
      .filter(p => p.innerText.trim().length > 20)
      .slice(0, maxResults);
    if (paras.length > 0) {
      result += paras.map(p => p.innerText.trim()).join('\n\n');
      return result;
    }

    return 'No search results found.';
  }, maxResults);
}

async function getPageInfo() {
  const p = await getPage();
  return { title: await p.title(), url: p.url() };
}

async function takeScreenshot() {
  const p = await getPage();
  const buffer = await p.screenshot({ type: 'png' });
  return buffer.toString('base64');
}

async function click(selector) {
  const p = await getPage();
  await p.click(selector, { timeout: 10000 });
  return `Clicked ${selector}`;
}

async function typeText(selector, text) {
  const p = await getPage();
  await p.fill(selector, text, { timeout: 10000 });
  return `Typed into ${selector}`;
}

async function scrollPage(direction, amount) {
  const p = await getPage();
  const delta = amount || 300;
  let x = 0, y = 0;
  if (direction === 'up') y = -delta;
  else if (direction === 'down') y = delta;
  else if (direction === 'left') x = -delta;
  else if (direction === 'right') x = delta;
  await p.evaluate(({ x, y }) => window.scrollBy(x, y), { x, y });
  return `Scrolled ${direction}`;
}

async function evaluate(code) {
  const p = await getPage();
  const result = await p.evaluate(code);
  return typeof result === 'object' ? JSON.stringify(result) : String(result);
}

async function waitForSelector(selector, timeout) {
  const p = await getPage();
  await p.waitForSelector(selector, { timeout: timeout || 10000 });
  return `Element visible: ${selector}`;
}

async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
    page = null;
    context = null;
    pageListenerAttached = false;
  }
}

// ─── Snapshot system (accessibility tree via CDP) ────────────────────────────
// Uses Chrome DevTools Protocol's Accessibility.getFullAXTree (via CDPSession)
// to detect ALL interactive elements — including clickable <div>, <span>, and
// role="button" elements that modern websites use. This works across all
// Playwright versions since it goes through CDP directly.
// Maps ref IDs to {role, name} locators and uses getByRole for actions instead
// of fragile CSS selectors.

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'textbox', 'searchbox',
  'combobox', 'listbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'slider', 'spinbutton', 'switch', 'tab', 'treeitem',
  'menubar', 'tablist', 'toolbar', 'tree',
]);

const TEXT_ROLES = new Set([
  'heading', 'article', 'note', 'alert', 'status', 'timer',
  'listitem', 'figure', 'caption', 'cell', 'gridcell', 'columnheader',
  'rowheader', 'label', 'definition', 'term', 'math', 'alertdialog',
  'dialog', 'region', 'tooltip', 'complementary', 'contentinfo',
  'banner', 'navigation', 'main', 'form', 'search', 'group', 'img',
]);

const SNAPSHOT_REFS = new WeakMap(); // Map<Page, Array<{role: string, name: string}>>

// ─── Snapshot size budget ───────────────────────────────────────────────────
// MAX_SNAPSHOT_CHARS caps the snapshot output at ~6000 tokens (chars / 4 ≈ tokens)
// to avoid hitting LLM provider rate limits (e.g. Groq 413 / TPM exceeded) on
// heavy sites like Amazon with hundreds of interactive elements.
const MAX_SNAPSHOT_CHARS = 24000;
const MAX_ELEMENT_NAME_LENGTH = 200;

// ─── CDP-based accessibility tree builder ───────────────────────────────────
// Uses Chrome DevTools Protocol's Accessibility.getFullAXTree to fetch the
// complete accessibility tree. This works across all Playwright versions and
// returns richer data than page.accessibility.snapshot().
// Converts the flat CDP node array into a nested tree structure.
async function buildAccessibilityTree(page) {
  try {
    const client = await page.context().newCDPSession(page);
    const { nodes } = await client.send('Accessibility.getFullAXTree');

    if (!nodes || nodes.length === 0) return null;

    // Build a map: nodeId -> processed entry
    const nodeMap = new Map();

    for (const node of nodes) {
      // Skip fully ignored nodes (internal layout / invisible)
      if (node.ignored && !node.childIds?.length) continue;

      const entry = {
        role: node.role?.value || '',
        name: node.name?.value || '',
        children: [],
        _childIds: node.childIds || [],
        _ignored: !!node.ignored,
        value: undefined,
        checked: undefined,
        disabled: undefined,
        level: undefined,
      };

      // Extract properties from the CDP properties array
      if (node.properties) {
        for (const prop of node.properties) {
          switch (prop.name) {
            case 'checked':
              entry.checked = prop.value?.value;
              break;
            case 'disabled':
              entry.disabled = prop.value?.value === true ? true : undefined;
              break;
            case 'level':
              entry.level = typeof prop.value?.value === 'number' ? prop.value.value : undefined;
              break;
            case 'value':
              entry.value = prop.value?.value;
              break;
            case 'valuetext':
              if (entry.value === undefined) entry.value = prop.value?.value;
              break;
          }
        }
      }

      nodeMap.set(node.nodeId, entry);
    }

    // Link children and track which nodes are referenced as children
    const childIdSet = new Set();
    for (const [, entry] of nodeMap) {
      if (entry._ignored || !entry._childIds.length) continue;
      for (const childId of entry._childIds) {
        const child = nodeMap.get(childId);
        if (child && !child._ignored) {
          entry.children.push(child);
          childIdSet.add(childId);
        }
      }
    }

    // Find root nodes (not referenced as a child of any other node)
    const roots = [];
    for (const [nodeId, entry] of nodeMap) {
      if (!entry._ignored && entry.role && !childIdSet.has(nodeId)) {
        roots.push(entry);
      }
    }

    if (roots.length === 0) return null;

    // Return the tree — single root directly, or wrap multiple roots
    const tree = roots.length === 1 ? roots[0] : { role: 'RootWebArea', name: '', children: roots };

    // Clean up internal fields from the tree
    function clean(node) {
      delete node._childIds;
      delete node._ignored;
      if (node.children) {
        for (const child of node.children) clean(child);
      }
    }
    clean(tree);

    // Clean the temporary map entries (in case any leaked into children)
    for (const [, entry] of nodeMap) {
      delete entry._childIds;
      delete entry._ignored;
    }

    return tree;
  } catch (e) {
    console.warn('CDP accessibility tree failed:', e.message);
    return null;
  }
}

async function snapshot() {
  const p = await getPage();

  // Use CDPSession (Chrome DevTools Protocol) to get accessibility tree.
  // The standard page.accessibility.snapshot() is not available in some
  // Playwright versions, but CDP's Accessibility domain works universally
  // with Chromium and returns richer data.
  const axTree = await buildAccessibilityTree(p);
  if (!axTree) return 'Page has no accessible content.';

  const interactiveItems = [];
  const locators = [];
  const textItems = [];

  function walk(node) {
    if (!node || !node.role) return;
    const role = node.role;
    const name = (node.name || '').trim();

    // Skip internal/low-level role types
    if (role === 'InlineTextBox' || role === 'text' || role === 'generic' ||
        role === 'none' || role === 'presentation' || role === 'paragraph') {
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      }
      return;
    }

    if (INTERACTIVE_ROLES.has(role) && name) {
      interactiveItems.push({ role, name, value: node.value, checked: node.checked, disabled: node.disabled });
      locators.push({ role, name });
    } else if (TEXT_ROLES.has(role) && name) {
      textItems.push({ role, name, level: node.level });
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }

  walk(axTree);

  SNAPSHOT_REFS.set(p, locators);

  // ── Build output ───────────────────────────────────────────────────────
  // Numbered ref IDs for interactive elements, indented descriptions for
  // text elements (no ref ID — can't be acted upon).
  let refId = 0;
  const lines = [];
  const textLines = [];

  for (const item of interactiveItems) {
    refId++;
    const { role, name, value, checked, disabled } = item;
    const val = value != null ? String(value) : '';

    // Truncate long element names to avoid blowing up the token budget
    const safeName = name.length > MAX_ELEMENT_NAME_LENGTH
      ? name.substring(0, MAX_ELEMENT_NAME_LENGTH) + '…'
      : name;

    switch (role) {
      case 'link':
        lines.push(`[${refId}] Link: "${safeName}"`);
        break;
      case 'button':
        lines.push(`[${refId}] Button: "${safeName}"${disabled ? ' (disabled)' : ''}`);
        break;
      case 'textbox':
      case 'searchbox':
        const tbLabel = role === 'textbox' ? 'Input' : 'Search';
        lines.push(`[${refId}] ${tbLabel}: "${safeName}"${disabled ? ' (disabled)' : ''}`);
        break;
      case 'combobox':
        lines.push(`[${refId}] Select: "${safeName}"`);
        break;
      case 'checkbox':
        lines.push(`[${refId}] Checkbox: "${safeName}"${checked !== undefined ? ` (${checked ? 'checked' : 'unchecked'})` : ''}`);
        break;
      case 'radio':
        lines.push(`[${refId}] Radio: "${safeName}"${checked ? ' (selected)' : ''}`);
        break;
      case 'switch':
        lines.push(`[${refId}] Switch: "${safeName}"${checked !== undefined ? ` (${checked ? 'on' : 'off'})` : ''}`);
        break;
      case 'slider':
        lines.push(`[${refId}] Slider: "${safeName}"${val ? ` (value: ${val})` : ''}`);
        break;
      case 'spinbutton':
        lines.push(`[${refId}] Spin button: "${safeName}"${val ? ` (value: ${val})` : ''}`);
        break;
      case 'tab':
        lines.push(`[${refId}] Tab: "${safeName}"`);
        break;
      case 'menuitem':
      case 'menuitemcheckbox':
      case 'menuitemradio':
        lines.push(`[${refId}] Menu item: "${safeName}"`);
        break;
      case 'option':
        lines.push(`[${refId}] Option: "${safeName}"`);
        break;
      default:
        lines.push(`[${refId}] ${role}: "${safeName}"`);
        break;
    }
  }

  // Build text lines separately (so we can drop them first when over budget)
  for (const item of textItems) {
    const { role, name, level } = item;
    const snippet = name.length > MAX_ELEMENT_NAME_LENGTH
      ? name.substring(0, MAX_ELEMENT_NAME_LENGTH) + '…'
      : name;
    const roleLabel = ({
      heading: level ? `Heading (h${level})` : 'Heading',
      listitem: 'List item',
      label: 'Label',
      cell: 'Cell',
      gridcell: 'Cell',
      columnheader: 'Col header',
      rowheader: 'Row header',
      caption: 'Caption',
      figure: 'Figure',
      article: 'Article',
      note: 'Note',
    })[role] || role;
    textLines.push(`  ${roleLabel}: "${snippet}"`);
  }

  // ── Token budget enforcement ───────────────────────────────────────────
  // Progressive truncation: drop text lines first, then cap interactive
  // items, so the LLM always gets the actionable elements it needs.
  function joinAndCap(interactive, text) {
    const allParts = [];
    if (interactive.length > 0) allParts.push(interactive.join('\n'));
    if (text.length > 0) {
      if (allParts.length > 0) allParts.push('');
      allParts.push(text.join('\n'));
    }
    let result = allParts.join('\n');

    if (result.length <= MAX_SNAPSHOT_CHARS) return result;

    // Step 1: Drop all text/indented lines (lowest priority — the AI can
    // use browser_get_text and browser_snapshot for detailed reading)
    result = interactive.join('\n');
    if (result.length <= MAX_SNAPSHOT_CHARS) {
      return result + '\n\n[... text content omitted — use browser_get_text to read, or call browser_snapshot for updated elements]';
    }

    // Step 2: Drop interactive items from the bottom until we fit
    const parts = [];
    let budget = MAX_SNAPSHOT_CHARS - 100; // leave room for truncation note
    for (let i = 0; i < interactive.length; i++) {
      const line = interactive[i];
      if (parts.length === 0) {
        parts.push(line);
        budget -= line.length;
      } else {
        const withNext = '\n' + line;
        if (budget - withNext.length >= 0) {
          parts.push(withNext);
          budget -= withNext.length;
        } else {
          break;
        }
      }
    }

    const dropped = interactive.length - parts.length;
    if (dropped > 0) {
      parts.push(`\n[... ${dropped} more elements — call browser_snapshot again to see them]`);
    }

    return parts.join('');
  }

  const output = joinAndCap(lines, textLines);
  return output || 'Page has no accessible content.';
}

function getSnapshotRefs(pageObj) {
  return SNAPSHOT_REFS.get(pageObj) || [];
}

async function act(refId, doAction, value) {
  const p = await getPage();
  const idx = Number(refId);
  const refs = getSnapshotRefs(p);

  if (isNaN(idx) || idx < 1 || idx > refs.length) {
    return `Invalid ref ID: ${refId}. Call browser_snapshot first to get valid IDs, then use the exact number.`;
  }
  const loc = refs[idx - 1];
  if (!loc) return `No element found for ref ID ${refId}. Call browser_snapshot again.`;

  if (doAction === 'click') {
    await p.getByRole(loc.role, { name: loc.name, exact: true }).click({ timeout: 10000 });
    return `Clicked [${refId}]`;
  } else if (doAction === 'type') {
    const el = p.getByRole(loc.role, { name: loc.name, exact: true });
    await el.fill(''); // clear existing content first
    await el.type(value || '', { delay: randomDelay(), timeout: 10000 });
    return `Typed into [${refId}]`;
  }
  return `Unknown action: ${doAction}. Use 'click' or 'type'.`;
}

async function actAndWait(refId, doAction, value) {
  const p = await getPage();
  const idx = Number(refId);
  const refs = getSnapshotRefs(p);

  if (isNaN(idx) || idx < 1 || idx > refs.length) {
    return `Invalid ref ID: ${refId}. Call browser_snapshot first to get valid IDs.`;
  }
  const loc = refs[idx - 1];
  if (!loc) return `No element found for ref ID ${refId}. Call browser_snapshot again.`;

  if (doAction === 'click') {
    if (loc.role === 'link') {
      // Click and wait for basic page navigation
      await Promise.all([
        p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
          // Navigation may not fire for SPA route changes or new tabs
        }),
        p.getByRole('link', { name: loc.name, exact: true }).click({ timeout: 10000 }),
      ]);

      // Additional SPA-friendly wait — let dynamic data finish loading
      // networkidle waits for no network requests for ~500ms
      // Wrapped in try/catch — background trackers/analytics may keep network busy
      try {
        await p.waitForLoadState('networkidle', { timeout: 5000 });
      } catch {
        // Network never fully idle — likely tracker polling, fine to proceed
      }

      return `Clicked [${refId}] (link) and waited for page to load.`;
    }

    await p.getByRole(loc.role, { name: loc.name, exact: true }).click({ timeout: 10000 });
    return `Clicked [${refId}]`;
  } else if (doAction === 'type') {
    const el = p.getByRole(loc.role, { name: loc.name, exact: true });
    await el.fill(''); // clear existing content first
    await el.type(value || '', { delay: randomDelay(), timeout: 10000 });
    return `Typed into [${refId}]`;
  }
  return `Unknown action: ${doAction}. Use 'click' or 'type'.`;
}

async function extractText(selector) {
  const p = await getPage();
  const el = await p.$(selector);
  if (!el) return `No element found for selector: ${selector}`;
  return await el.innerText();
}

// ─── Main export ─────────────────────────────────────────────────────────────
module.exports = {
  navigate:          (...args) => withLock(() => navigate(...args)),
  getText:           (...args) => withLock(() => getText(...args)),
  getPageSummary:    (...args) => withLock(() => getPageSummary(...args)),
  getSearchResultsSummary: (...args) => withLock(() => getSearchResultsSummary(...args)),
  getPageInfo:       (...args) => withLock(() => getPageInfo(...args)),
  takeScreenshot:    (...args) => withLock(() => takeScreenshot(...args)),
  getPage:           (...args) => withLock(() => getPage(...args)),
  click:             (...args) => withLock(() => click(...args)),
  typeText:          (...args) => withLock(() => typeText(...args)),
  scrollPage:        (...args) => withLock(() => scrollPage(...args)),
  evaluate:          (...args) => withLock(() => evaluate(...args)),
  waitForSelector:   (...args) => withLock(() => waitForSelector(...args)),
  closeBrowser:      (...args) => withLock(() => closeBrowser(...args)),
  snapshot:          (...args) => withLock(() => snapshot(...args)),
  act:               (...args) => withLock(() => act(...args)),
  actAndWait:        (...args) => withLock(() => actAndWait(...args)),
  extractText:       (...args) => withLock(() => extractText(...args)),
};
