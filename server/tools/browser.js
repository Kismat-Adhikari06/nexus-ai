const browserService = require('../services/browserService');

async function launch() {
  await browserService.getPage();
  return 'Browser launched';
}

async function close() {
  await browserService.closeBrowser();
  return 'Browser closed';
}

async function openUrl(url, maxParagraphs, maxChars) {
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  const paragraphs = maxParagraphs != null ? Number(maxParagraphs) : 5;
  const chars = maxChars != null ? Number(maxChars) : 3000;
  const summary = await browserService.getPageSummary(paragraphs, chars);
  return `Opened ${info.url}\nTitle: ${info.title}\n\n--- Page Preview ---\n${summary}`;
}

async function searchWeb(query, maxParagraphs, maxChars) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  const maxResults = maxParagraphs != null ? Number(maxParagraphs) : 8;
  const summary = await browserService.getSearchResultsSummary(maxResults);
  return `Searched DuckDuckGo for: ${query}\nTitle: ${info.title}\n\n--- Search Results ---\n${summary}`;
}

async function navigate(url) {
  await browserService.navigate(url);
  const info = await browserService.getPageInfo();
  return `Navigated to ${info.url}\nTitle: ${info.title}`;
}

async function snapshot() {
  return await browserService.snapshot();
}

async function act(refId, doAction, value) {
  return await browserService.act(refId, doAction, value);
}

async function actAndWait(refId, doAction, value) {
  return await browserService.actAndWait(refId, doAction, value);
}

async function getPageText() {
  return await browserService.getText();
}

async function extractText(selector) {
  return await browserService.extractText(selector);
}

async function screenshot() {
  return await browserService.takeScreenshot();
}

module.exports = {
  launch, close, openUrl, searchWeb, navigate, snapshot, act, actAndWait,
  extractText, getPageText, screenshot,
};
