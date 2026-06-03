const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const DESKTOP = path.join(HOME, 'Desktop');
const DOCUMENTS = path.join(HOME, 'Documents');

function fuzzyFind(p) {
  const expanded = path.resolve(p.replace(/\\/g, '/'));
  if (fs.existsSync(expanded)) return expanded;
  for (const parent of [DESKTOP, DOCUMENTS, HOME]) {
    const candidate = path.join(parent, expanded);
    if (fs.existsSync(candidate)) return candidate;
  }
  return expanded;
}

function readPdf(p) {
  try {
    const full = fuzzyFind(p);
    if (!fs.existsSync(full)) return `Could not find: ${p}`;

    // Try using Python's PyMuPDF if available
    try {
      const result = execSync(
        `python -c "import fitz; doc=fitz.open('${full.replace(/'/g, "'\\''")}'); print('---PAGE BREAK---'.join(page.get_text() for page in doc))"`,
        { timeout: 15000, encoding: 'utf-8' }
      );
      const text = result.trim();
      if (text) return text.substring(0, 3000);
    } catch { /* Python not available, try next method */ }

    // Fallback: try with PowerShell
    try {
      const escapedPath = full.replace(/'/g, "''");
      const ps = `
        Add-Type -AssemblyName System.Speech
        $path = '${escapedPath}'
        $reader = New-Object -ComObject "AcroExch.App"
        $doc = New-Object -ComObject "AcroExch.PDDoc"
        if ($doc.Open($path)) {
          $count = $doc.GetNumPages()
          $text = ""
          for ($i = 0; $i -lt [Math]::Min($count, 10); $i++) {
            $page = $doc.AcquirePage($i)
            $text += $page.GetText()
          }
          $doc.Close()
          $reader.Exit()
          Write-Output $text
        } else {
          Write-Output "Could not open PDF"
        }
      `;
      const result = execSync(`powershell -command "${ps}"`, { timeout: 15000, encoding: 'utf-8' });
      const text = result.trim();
      if (text && !text.includes('Could not open')) return text.substring(0, 3000);
    } catch { /* PowerShell method failed */ }

    return `PDF reader: ${path.basename(full)} found but couldn't extract text. Try installing Python with PyMuPDF (pip install PyMuPDF)`;
  } catch (e) {
    return `Failed to read PDF: ${e.message}`;
  }
}

module.exports = { readPdf };
