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

module.exports = {
  navigate, getText, getPageInfo, takeScreenshot,
  click, typeText, scrollPage, evaluate, waitForSelector, closeBrowser,
};
