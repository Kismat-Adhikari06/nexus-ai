const browserService = require('../services/browserService');

async function openUrl(url) {
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  const snap = await browserService.snapshot();
  return `Opened ${info.url}\nTitle: ${info.title}\n\nPage snapshot:\n${snap}`;
}

async function searchWeb(query) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  const snap = await browserService.snapshot();
  return `Searched Google for: ${query}\nTitle: ${info.title}\n\nPage snapshot:\n${snap}`;
}

async function navigate(url) {
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  return `Navigated to ${info.url}\nTitle: ${info.title}`;
}

async function snapshot() {
  return await browserService.snapshot();
}

async function act(refId, action, value) {
  return await browserService.act(refId, action, value);
}

async function extractText(selector) {
  return await browserService.extractText(selector);
}

async function screenshot() {
  return await browserService.takeScreenshot();
}

module.exports = {
  openUrl, searchWeb, navigate, snapshot, act, extractText, screenshot,
};
