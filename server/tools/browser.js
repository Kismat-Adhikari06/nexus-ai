const browserService = require('../services/browserService');

async function openUrl(url) {
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  const text = (await browserService.getText()).substring(0, 800);
  return `Opened ${url}\nTitle: ${info.title}\nContent:\n${text}`;
}

async function searchWeb(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  const text = (await browserService.getText()).substring(0, 800);
  return `Searched Google for: ${query}\nTitle: ${info.title}\nResults:\n${text}`;
}

async function navigate(url) {
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  return `Navigated to ${info.url}\nTitle: ${info.title}`;
}

async function clickElement(selector) {
  return await browserService.click(selector);
}

async function typeInto(selector, text) {
  return await browserService.typeText(selector, text);
}

async function screenshot() {
  const base64 = await browserService.takeScreenshot();
  return `data:image/png;base64,${base64}`;
}

async function getPageText() {
  const text = await browserService.getText();
  return text || 'Page has no visible text content.';
}

async function scrollPage(direction, amount) {
  return await browserService.scrollPage(direction, amount);
}

async function evaluateJS(code) {
  return await browserService.evaluate(code);
}

async function getPageInfo() {
  const info = await browserService.getPageInfo();
  return `Title: ${info.title}\nURL: ${info.url}`;
}

async function waitForElement(selector, timeout) {
  return await browserService.waitForSelector(selector, timeout);
}

module.exports = {
  openUrl, searchWeb, navigate, clickElement, typeInto,
  screenshot, getPageText, scrollPage, evaluateJS, getPageInfo, waitForElement,
};
