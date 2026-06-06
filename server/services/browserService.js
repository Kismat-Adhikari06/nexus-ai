const { chromium } = require('playwright');

const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

let browser = null;
let page = null;

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

async function getPage() {
  const b = await getBrowser();
  if (page && !page.isClosed()) return page;
  const contexts = b.contexts();
  if (contexts.length > 0) {
    const pages = contexts[0].pages();
    if (pages.length > 0) {
      page = pages[0];
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      return page;
    }
  }
  const context = await b.newContext({
    bypassCSP: true,
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
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
  }
}

// ─── Snapshot system ─────────────────────────────────────────────────────────
const SNAPSHOT_REFS = new WeakMap();

async function snapshot() {
  const p = await getPage();

  const elements = await p.evaluate(() => {
    const items = [];

    document.querySelectorAll('a, button, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])').forEach(el => {
      if (el.type === 'hidden') return;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const tag = el.tagName.toLowerCase();
      const type = el.type || '';
      const text = el.innerText || el.value || el.placeholder || '';
      const selector = buildSelector(el);
      if (tag === 'a') {
        items.push({ type: 'link', text: text.trim(), href: el.href, selector });
      } else if (tag === 'button' || el.getAttribute('role') === 'button') {
        items.push({ type: 'button', text: text.trim(), selector });
      } else if (tag === 'input' || tag === 'textarea') {
        items.push({ type: 'input', text: text.trim(), selector, inputType: type });
      } else if (tag === 'select') {
        items.push({ type: 'select', text: text.trim(), selector });
      }
    });

    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, th, td, label, figcaption, blockquote').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const text = el.innerText.trim();
      if (text) {
        items.push({ type: 'text', text: text.substring(0, 200), tag: el.tagName.toLowerCase(), selector: buildSelector(el) });
      }
    });

    return items;

    function buildSelector(el) {
      if (el.id) return '#' + CSS.escape(el.id);
      if (el.name) return el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
      let sel = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
        if (cls) sel += cls;
      }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(el) + 1;
          sel += ':nth-of-type(' + idx + ')';
        }
      }
      return sel;
    }
  });

  const refs = elements.map(el => el.selector);
  SNAPSHOT_REFS.set(p, refs);

  const lines = [];
  let refId = 0;
  for (const el of elements) {
    refId++;
    switch (el.type) {
      case 'link':
        lines.push(`[${refId}] Link: "${el.text}" → ${el.href}`);
        break;
      case 'button':
        lines.push(`[${refId}] Button: "${el.text}"`);
        break;
      case 'input':
        lines.push(`[${refId}] Input: "${el.text}"${el.inputType ? ' (type: ' + el.inputType + ')' : ''}`);
        break;
      case 'select':
        lines.push(`[${refId}] Select: "${el.text}"`);
        break;
      case 'text':
        const label = ({
          h1:'Heading', h2:'Heading', h3:'Heading', h4:'Heading', h5:'Heading', h6:'Heading',
          p:'Text', li:'List item', td:'Cell', th:'Cell', label:'Label',
          figcaption:'Caption', blockquote:'Quote',
        })[el.tag] || el.tag;
        lines.push(`[${refId}] ${label}: "${el.text}"`);
        break;
    }
  }
  return lines.join('\n') || 'Page has no interactive or readable content.';
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
  const selector = refs[idx - 1];
  if (!selector) return `No element found for ref ID ${refId}. Call browser_snapshot again.`;

  if (doAction === 'click') {
    await p.click(selector, { timeout: 10000 });
    return `Clicked [${refId}]`;
  } else if (doAction === 'type') {
    await p.fill(selector, value || '', { timeout: 10000 });
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
  const selector = refs[idx - 1];
  if (!selector) return `No element found for ref ID ${refId}. Call browser_snapshot again.`;

  if (doAction === 'click') {
    const isLink = await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return el.tagName === 'A' || !!el.closest('a');
    }, selector);

    if (isLink) {
      await Promise.all([
        p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        p.click(selector, { timeout: 10000 }),
      ]);
      return `Clicked [${refId}] (link) and waited for page to load.`;
    }

    await p.click(selector, { timeout: 10000 });
    return `Clicked [${refId}]`;
  } else if (doAction === 'type') {
    await p.fill(selector, value || '', { timeout: 10000 });
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
