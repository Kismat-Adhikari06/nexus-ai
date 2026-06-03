const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function clipboardRead() {
  try {
    const result = execSync('powershell -command "Get-Clipboard"', { timeout: 5000, encoding: 'utf-8' });
    return (result || '').trim().substring(0, 500) || 'Clipboard is empty';
  } catch {
    return 'Failed to read clipboard';
  }
}

function clipboardCopy(text) {
  try {
    const escaped = text.replace(/'/g, "''");
    execSync(`powershell -command "Set-Clipboard -Value '${escaped}'"`, { timeout: 5000 });
    return 'Copied to clipboard';
  } catch {
    return 'Failed to copy to clipboard';
  }
}

function screenshot() {
  try {
    const saveDir = path.join(os.homedir(), '.nexu', 'screenshots');
    fs.mkdirSync(saveDir, { recursive: true });
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(saveDir, filename);
    
    // Use PowerShell to take screenshot
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen(0, 0, 0, 0, $bitmap.Size)
      $bitmap.Save('${filepath.replace(/'/g, "''")}')
      $graphics.Dispose()
      $bitmap.Dispose()
    `;
    execSync(`powershell -command "${ps}"`, { timeout: 10000 });
    return `Screenshot saved to ${filepath}`;
  } catch (e) {
    return `Screenshot failed: ${e.message}`;
  }
}

// Score how well a video title matches the user's search query
// Higher score = better match
function scoreMatch(title, query) {
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  
  // Exact match (case-insensitive) = best
  if (t === q) return 100;
  // Title starts with query
  if (t.startsWith(q)) return 90;
  // Query is a substring of title
  if (t.includes(q)) return 80;
  
  // Word-level matching: what fraction of significant query words appear as exact words in the title
  const queryWords = q.split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  const titleWordSet = new Set(t.split(/[^a-z0-9]+/).filter(w => w.length >= 3));
  
  if (queryWords.length === 0) return 0;
  
  let matched = 0;
  for (const word of queryWords) {
    if (titleWordSet.has(word)) {
      matched++;
    }
  }
  
  return Math.round((matched / queryWords.length) * 70);
}

function playYoutube(query) {
  try {
    let videoId = null;
    let bestScore = -1;

    // Method 1: Try yt-dlp to find the best matching video
    try {
      // Fetch 5 results with IDs and titles so we can pick the best match
      const result = spawnSync('yt-dlp', [
        '--flat-playlist',
        '--print', '%(id)s|%(title)s',
        'ytsearch5:' + query,
      ], { timeout: 15000, encoding: 'utf-8' });

      if (result.stdout && result.stdout.trim()) {
        const lines = result.stdout.trim().split('\n');
        for (const line of lines) {
          const sep = line.indexOf('|');
          if (sep === -1) continue;
          const id = line.substring(0, sep).trim();
          const title = line.substring(sep + 1).trim();
          if (!id || !title) continue;

          const score = scoreMatch(title, query);
          if (score > bestScore) {
            bestScore = score;
            videoId = id;
          }
        }
      }
    } catch { /* yt-dlp not available */ }

    if (videoId) {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      execSync(`start "" "${watchUrl}"`, { shell: true, timeout: 5000 });
      return `Playing "${query}" on YouTube`;
    }

    // Method 2: Fall back to opening search results
    const encoded = encodeURIComponent(query);
    const searchUrl = `https://www.youtube.com/results?search_query=${encoded}`;
    execSync(`start "" "${searchUrl}"`, { shell: true, timeout: 5000 });
    return `Opened YouTube search results for "${query}"`;
  } catch (e) {
    return `Failed: ${e.message}`;
  }
}

module.exports = { clipboardRead, clipboardCopy, screenshot, playYoutube };
