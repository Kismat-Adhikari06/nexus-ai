const { chromium } = require('playwright');

let browser = null;
let page = null;

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({ headless: true });
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
      return page;
    }
  }
  const context = await b.newContext({ bypassCSP: true });
  page = await context.newPage();
  return page;
}

async function navigate(url) {
  const p = await getPage();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  return `Navigated to ${url}`;
}

async function getText() {
  const p = await getPage();
  return await p.evaluate(() => document.body.innerText);
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
  await p.click(selector, { timeout: 5000 });
  return `Clicked ${selector}`;
}

async function typeText(selector, text) {
  const p = await getPage();
  await p.fill(selector, text, { timeout: 5000 });
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
  await p.waitForSelector(selector, { timeout: timeout || 5000 });
  return `Element visible: ${selector}`;
}

async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
    page = null;
  }
}

// Snapshot: scrape all interactive and readable elements, return numbered list
let _snapshotRefs = [];

async function snapshot() {
  const p = await getPage();
  _snapshotRefs = [];

  const elements = await p.evaluate(() => {
    const items = [];

    // collect interactive elements
    document.querySelectorAll('a, button, input, textarea, select, [role="button"], [tabindex]:not([tabindex="-1"])').forEach(el => {
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

    // collect readable text sections (headings, paragraphs, list items)
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, th, td, label, figcaption, blockquote').forEach(el => {
      const text = el.innerText.trim();
      if (text) {
        items.push({ type: 'text', text: text.substring(0, 200), tag: el.tagName.toLowerCase(), selector: buildSelector(el) });
      }
    });

    return items;

    function buildSelector(el) {
      if (el.id) return '#' + CSS.escape(el.id);
      if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
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

  const lines = [];
  let refId = 0;
  for (const el of elements) {
    refId++;
    _snapshotRefs.push(el.selector);
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
        lines.push(`[${refId}] <${el.tag}>: "${el.text}"`);
        break;
    }
  }
  return lines.join('\n') || 'Page has no interactive or readable content.';
}

async function act(refId, action, value) {
  const p = await getPage();
  const idx = Number(refId);
  if (isNaN(idx) || idx < 1 || idx > _snapshotRefs.length) {
    return `Invalid ref ID: ${refId}. Call snapshot() first to get valid IDs.`;
  }
  const selector = _snapshotRefs[idx - 1];
  if (!selector) return `No element found for ref ID ${refId}. Call snapshot() again.`;

  if (action === 'click') {
    await p.click(selector, { timeout: 5000 });
    return `Clicked [${refId}]`;
  } else if (action === 'type') {
    await p.fill(selector, value || '', { timeout: 5000 });
    return `Typed into [${refId}]`;
  }
  return `Unknown action: ${action}. Use 'click' or 'type'.`;
}

async function extractText(selector) {
  const p = await getPage();
  const el = await p.$(selector);
  if (!el) return `No element found for selector: ${selector}`;
  return await el.innerText();
}

module.exports = {
  navigate, getText, getPageInfo, takeScreenshot,
  click, typeText, scrollPage, evaluate, waitForSelector, closeBrowser,
  snapshot, act, extractText,
};
