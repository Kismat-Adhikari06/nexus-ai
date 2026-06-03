const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const HOME = os.homedir();
const DESKTOP = path.join(HOME, 'Desktop');
const DOCUMENTS = path.join(HOME, 'Documents');

const SKIP_DIRS = new Set(['appdata', 'node_modules', '.git', '__pycache__', 'cache', 'temp', 'tmp', '.npm']);

function fuzzyFind(p) {
  const expanded = path.resolve(p.replace(/\\/g, '/'));
  if (fs.existsSync(expanded)) return expanded;

  for (const parent of [DESKTOP, DOCUMENTS, HOME]) {
    const candidate = path.join(parent, expanded);
    if (fs.existsSync(candidate)) return candidate;
  }
  return expanded;
}

function openFile(p) {
  try {
    const full = fuzzyFind(p);
    if (!fs.existsSync(full)) return `Could not find: ${p}`;
    execSync(`start "" "${full}"`, { shell: true, timeout: 5000 });
    return `Opened ${path.basename(full)}`;
  } catch (e) {
    return `Failed to open ${p}: ${e.message}`;
  }
}

function openInVscode(p) {
  try {
    const full = fuzzyFind(p);
    if (!fs.existsSync(full)) return `Could not find: ${p}`;
    execSync(`code "${full}"`, { shell: true, timeout: 5000 });
    return `Opened ${path.basename(full)} in VS Code`;
  } catch (e) {
    return `Failed to open in VS Code: ${e.message}`;
  }
}

function searchFiles(query, location) {
  const root = location ? path.resolve(location) : DESKTOP;
  if (!fs.existsSync(root)) return `Directory not found: ${root}`;

  const matches = [];
  const startTime = Date.now();
  const TIMEOUT = 15000;
  
  try {
    const walk = (dir) => {
      if (matches.length >= 10) return;
      if (Date.now() - startTime > TIMEOUT) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (matches.length >= 10) return;
          if (Date.now() - startTime > TIMEOUT) return;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name.toLowerCase())) {
              walk(full);
            }
          } else if (entry.name.toLowerCase().includes(query.toLowerCase())) {
            matches.push(full);
          }
        }
      } catch { /* skip inaccessible dirs */ }
    };
    walk(root);
  } catch (e) {
    return `Search failed: ${e.message}`;
  }

  if (matches.length === 0) return `No files found matching '${query}'`;
  return 'Found:\n' + matches.join('\n');
}

function findFile(filename) {
  for (const root of [DESKTOP, DOCUMENTS, HOME]) {
    if (!fs.existsSync(root)) continue;
    const result = searchFiles(filename, root);
    if (result.startsWith('Found')) return result;
  }
  return `Could not find '${filename}' anywhere`;
}

function getFileInfo(p) {
  try {
    const full = fuzzyFind(p);
    if (!fs.existsSync(full)) return `Could not find: ${p}`;
    const stat = fs.statSync(full);
    const size = stat.size;
    const sizeStr = size > 1e9 ? `${(size / 1e9).toFixed(1)} GB` :
      size > 1e6 ? `${(size / 1e6).toFixed(1)} MB` :
      size > 1e3 ? `${(size / 1e3).toFixed(1)} KB` :
      `${size} B`;
    return `${path.basename(full)} — ${sizeStr}, modified ${stat.mtime.toLocaleDateString()}`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

function listDirectory(p) {
  try {
    const full = p ? fuzzyFind(p) : DESKTOP;
    if (!fs.existsSync(full)) return `Could not find directory: ${p || 'Desktop'}`;
    const items = fs.readdirSync(full);
    const dirs = items.filter(i => fs.statSync(path.join(full, i)).isDirectory()).slice(0, 10).map(i => `📁 ${i}`);
    const files = items.filter(i => !fs.statSync(path.join(full, i)).isDirectory()).slice(0, 10).map(i => `📄 ${i}`);
    return [...dirs, ...files].join('\n') || 'Empty directory';
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

module.exports = { openFile, openInVscode, searchFiles, findFile, getFileInfo, listDirectory };
