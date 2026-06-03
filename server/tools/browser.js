const { execSync } = require('child_process');

function openUrl(url) {
  try {
    if (!url.startsWith('http')) url = 'https://' + url;
    execSync(`start "" "${url}"`, { shell: true, timeout: 5000 });
    return `Opened ${url}`;
  } catch (e) {
    return `Failed: ${e.message}`;
  }
}

function searchWeb(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://www.google.com/search?q=${encoded}`;
    execSync(`start "" "${url}"`, { shell: true, timeout: 5000 });
    return `Searched Google for: ${query}`;
  } catch (e) {
    return `Failed: ${e.message}`;
  }
}

module.exports = { openUrl, searchWeb };
