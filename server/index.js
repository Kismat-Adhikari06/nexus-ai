const express = require('express');
const cors = require('cors');
const { authenticateToken } = require('./auth');
const system = require('./tools/system');
const files = require('./tools/files');
const browser = require('./tools/browser');
const extra = require('./tools/extra');
const pdf = require('./tools/pdf');
const whatsapp = require('./tools/whatsapp');
const storageRouter = require('./routes/storage');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// System tools
app.get('/api/system/lock', (_, res) => res.json({ result: system.lockWorkstation() }));
app.get('/api/system/sleep', (_, res) => res.json({ result: system.sleep() }));
app.get('/api/system/shutdown', (_, res) => res.json({ result: system.shutdown() }));
app.get('/api/system/hibernate', (_, res) => res.json({ result: system.hibernate() }));
app.get('/api/system/battery', (_, res) => res.json({ result: system.getBattery() }));
app.get('/api/system/cpu', (_, res) => res.json({ result: system.getCpu() }));
app.get('/api/system/ram', (_, res) => res.json({ result: system.getRam() }));
app.post('/api/system/volume', (req, res) => res.json({ result: system.setVolume(req.body.level) }));
app.post('/api/system/notify', (req, res) => res.json({ result: system.notify(req.body.title, req.body.message) }));
app.post('/api/system/command', (req, res) => res.json({ result: system.runCommand(req.body.command) }));
app.post('/api/system/launch', (req, res) => res.json({ result: system.launchApp(req.body.name) }));

// File tools
app.post('/api/files/open', (req, res) => res.json({ result: files.openFile(req.body.path) }));
app.post('/api/files/vscode', (req, res) => res.json({ result: files.openInVscode(req.body.path) }));
app.post('/api/files/search', (req, res) => res.json({ result: files.searchFiles(req.body.query, req.body.location) }));
app.post('/api/files/find', (req, res) => res.json({ result: files.findFile(req.body.filename) }));
app.post('/api/files/info', (req, res) => res.json({ result: files.getFileInfo(req.body.path) }));
app.post('/api/files/list', (req, res) => res.json({ result: files.listDirectory(req.body.path) }));

// Browser tools (Playwright — persistent headless browser, all auth-protected)
app.post('/api/browser/launch', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.launch() }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/close', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.close() }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/open', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.openUrl(req.body.url, req.body.maxParagraphs, req.body.maxChars) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/search', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.searchWeb(req.body.query, req.body.maxParagraphs, req.body.maxChars) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/navigate', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.navigate(req.body.url) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/snapshot', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.snapshot() }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/act', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.act(req.body.refId, req.body.do, req.body.value) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/actAndWait', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.actAndWait(req.body.refId, req.body.do, req.body.value) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/extractText', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.extractText(req.body.selector) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/getText', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.getPageText() }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/browser/screenshot', authenticateToken, async (req, res) => {
  try { res.json({ result: await browser.screenshot() }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});

// PDF tools
app.post('/api/files/read-pdf', (req, res) => res.json({ result: pdf.readPdf(req.body.path) }));

// WhatsApp tools (Baileys - async)
app.get('/api/whatsapp/chats', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  try { res.json({ result: await whatsapp.listChats(limit) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/messages', async (req, res) => {
  try { res.json({ result: await whatsapp.getMessages(req.body.chat, parseInt(req.body.limit) || 10) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/send', async (req, res) => {
  try { res.json({ result: await whatsapp.sendMessage(req.body.to, req.body.message) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/send-number', async (req, res) => {
  try { res.json({ result: await whatsapp.sendMessageByNumber(req.body.phoneNumber, req.body.message) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.get('/api/whatsapp/unread', async (_, res) => {
  try { res.json({ result: await whatsapp.getUnreadMessages() }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.get('/api/whatsapp/status', (_, res) => res.json({ result: whatsapp.getStatus() }));

// Extra tools
app.get('/api/extra/clipboard-read', (_, res) => res.json({ result: extra.clipboardRead() }));
app.post('/api/extra/clipboard-copy', (req, res) => res.json({ result: extra.clipboardCopy(req.body.text) }));
app.post('/api/extra/screenshot', (_, res) => res.json({ result: extra.screenshot() }));
app.post('/api/extra/youtube', (req, res) => res.json({ result: extra.playYoutube(req.body.query) }));

// WhatsApp QR code page — shows QR, status, or connected info
app.get('/api/whatsapp/qr', (_, res) => {
  const qr = whatsapp.getQR();
  const status = whatsapp.getStatus();
  const isConnected = qr.connected;
  const isConnecting = qr.connecting;
  const hasQR = !!qr.qrImage;

  let pageTitle, pageDesc, badgeText, badgeColor, badgeBg, badgeBorder, content;

  if (isConnected) {
    pageTitle = '✅ WhatsApp Connected';
    pageDesc = 'Nexu is linked to your WhatsApp. You can send and read messages through the chat.';
    badgeText = '✅ Connected';
    badgeColor = '#22c55e';
    badgeBg = '#22c55e20';
    badgeBorder = '#22c55e40';
    content = `
      <div style="
        background: #1a1a23; border: 1px solid #2a2a3e; border-radius: 16px;
        padding: 40px 20px; margin-bottom: 20px;
      ">
        <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
        <h2 style="color: #e4e4ee; font-size: 20px; margin-bottom: 8px;">Nexu is connected to WhatsApp</h2>
        <p style="color: #8b8b9e; font-size: 14px;">You can now use WhatsApp features in the chat.</p>
      </div>
      <a href="/api/whatsapp/clear" onclick="event.preventDefault(); fetch('/api/whatsapp/clear',{method:'POST'}).then(()=>location.reload())"
         style="
           display: inline-block; padding: 10px 24px; background: #ef4444; color: white;
           border: none; border-radius: 8px; font-size: 14px; cursor: pointer;
           text-decoration: none;
         ">🔌 Disconnect</a>
    `;
  } else if (hasQR) {
    pageTitle = '🔗 Link WhatsApp';
    pageDesc = 'Scan this QR code with your phone to connect Nexu to WhatsApp';
    badgeText = '⏳ Waiting for scan...';
    badgeColor = '#eab308';
    badgeBg = '#eab30820';
    badgeBorder = '#eab30840';
    content = `
      <div style="
        background: white; border-radius: 16px; padding: 20px;
        display: inline-block; box-shadow: 0 8px 32px rgba(124, 58, 237, 0.15);
      ">
        <img src="${qr.qrImage}" alt="QR Code" style="display: block; width: 300px; height: 300px; image-rendering: pixelated;" />
      </div>
      <div style="
        text-align: left; background: #1a1a23; border: 1px solid #2a2a3e;
        border-radius: 12px; padding: 20px; margin-top: 20px;
      ">
        <ol style="padding-left: 20px; margin: 0;">
          <li style="margin-bottom: 8px; color: #c4c4d0; font-size: 14px;">Open <strong>WhatsApp</strong> on your phone</li>
          <li style="margin-bottom: 8px; color: #c4c4d0; font-size: 14px;">Go to <strong>Settings → Linked Devices</strong></li>
          <li style="margin-bottom: 8px; color: #c4c4d0; font-size: 14px;">Tap <strong>Link a Device</strong></li>
          <li style="color: #c4c4d0; font-size: 14px;">Scan the QR code above</li>
        </ol>
      </div>
    `;
  } else if (isConnecting) {
    pageTitle = '⏳ Connecting...';
    pageDesc = 'Nexu is establishing a connection. QR code will appear shortly.';
    badgeText = '⏳ Connecting...';
    badgeColor = '#eab308';
    badgeBg = '#eab30820';
    badgeBorder = '#eab30840';
    content = `
      <div style="
        background: #1a1a23; border: 1px solid #2a2a3e; border-radius: 16px;
        padding: 40px 20px; margin-bottom: 20px;
      ">
        <div style="font-size: 64px; margin-bottom: 16px;">⏳</div>
        <h2 style="color: #e4e4ee; font-size: 20px; margin-bottom: 8px;">Connecting to WhatsApp...</h2>
        <p style="color: #8b8b9e; font-size: 14px;">Try calling a WhatsApp tool from the chat to trigger the QR code.</p>
      </div>
    `;
  } else {
    pageTitle = '🔗 WhatsApp';
    pageDesc = 'Not connected to WhatsApp. Call a WhatsApp tool from the chat to start.';
    badgeText = '❌ Not connected';
    badgeColor = '#ef4444';
    badgeBg = '#ef444420';
    badgeBorder = '#ef444440';
    content = `
      <div style="
        background: #1a1a23; border: 1px solid #2a2a3e; border-radius: 16px;
        padding: 40px 20px; margin-bottom: 20px;
      ">
        <div style="font-size: 64px; margin-bottom: 16px;">📱</div>
        <h2 style="color: #e4e4ee; font-size: 20px; margin-bottom: 8px;">Not Connected</h2>
        <p style="color: #8b8b9e; font-size: 14px;">Click the button below to start connecting Nexu to WhatsApp.</p>
        <button class="btn" style="background: #7c3aed;" onclick="
          fetch('/api/whatsapp/connect',{method:'POST'}).then(()=>location.reload())
        ">🔗 Start Connection</button>
      </div>
    `;
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Nexu - ${pageTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f0f13;
      color: #e4e4ee;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container { text-align: center; max-width: 500px; width: 100%; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #8b8b9e; margin-bottom: 24px; line-height: 1.5; }
    .badge {
      display: inline-block; padding: 6px 16px; border-radius: 20px;
      font-size: 13px; font-weight: 600; margin-bottom: 20px;
    }
    .btn {
      display: inline-block; padding: 10px 24px; color: white;
      border: none; border-radius: 8px; font-size: 14px; cursor: pointer;
      text-decoration: none; margin-top: 16px; transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${pageTitle}</h1>
    <p>${pageDesc}</p>
    <div class="badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">${badgeText}</div>
    ${content}
    <div style="margin-top: 12px;">
      <button class="btn" style="background: #7c3aed;" onclick="location.reload()">🔄 Refresh</button>
    </div>
    <p id="autoStatus" style="margin-top: 16px; color: #6b6b7e; font-size: 12px;"></p>
  </div>
  <script>
    // Auto-refresh on connection status change — poll every 2s
    (function poll() {
      fetch('/api/whatsapp/qr-data')
        .then(r => r.json())
        .then(d => {
          const r = d && d.result ? d.result : d;
          const wasConnected = ${isConnected};
          const isNowConnected = r && r.connected;
          const isNowConnecting = r && r.connecting;
          const hasQR = r && r.qrImage;

          document.getElementById('autoStatus').textContent =
            isNowConnected ? '✅ Connected — auto-detected' :
            isNowConnecting ? '⏳ Establishing connection...' :
            hasQR ? '📱 Waiting for scan...' :
            '❌ Not connected';

          if (!wasConnected && isNowConnected) {
            setTimeout(function(){ location.reload(); }, 800);
            return;
          }
          // Also refresh when QR first appears while connecting
          if (!${hasQR ? 'true' : 'false'} && hasQR && !isNowConnected) {
            setTimeout(function(){ location.reload(); }, 800);
            return;
          }
          setTimeout(poll, 2000);
        })
        .catch(function(){ setTimeout(poll, 2000); });
    })();
  </script>
</body>
</html>`);
});

// WhatsApp QR image data (raw base64 data URL for programmatic use)
app.get('/api/whatsapp/qr-data', (_, res) => res.json({ result: whatsapp.getQR() }));

// WhatsApp clear session (logs out and deletes saved auth)
app.post('/api/whatsapp/clear', (_, res) => res.json({ result: whatsapp.clearSession() }));

// WhatsApp chat management
app.post('/api/whatsapp/block', async (req, res) => {
  try { res.json({ result: await whatsapp.blockContact(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/unblock', async (req, res) => {
  try { res.json({ result: await whatsapp.unblockContact(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/delete-chat', async (req, res) => {
  try { res.json({ result: await whatsapp.deleteChat(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/archive', async (req, res) => {
  try { res.json({ result: await whatsapp.archiveChat(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/unarchive', async (req, res) => {
  try { res.json({ result: await whatsapp.unarchiveChat(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/mute', async (req, res) => {
  try { res.json({ result: await whatsapp.muteChat(req.body.contact, req.body.duration || 'always') }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/unmute', async (req, res) => {
  try { res.json({ result: await whatsapp.unmuteChat(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/pin', async (req, res) => {
  try { res.json({ result: await whatsapp.pinChat(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/unpin', async (req, res) => {
  try { res.json({ result: await whatsapp.unpinChat(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/mark-read', async (req, res) => {
  try { res.json({ result: await whatsapp.markAsRead(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});
app.post('/api/whatsapp/report', async (req, res) => {
  try { res.json({ result: await whatsapp.reportContact(req.body.contact) }); }
  catch (e) { res.json({ result: `Error: ${e.message}` }); }
});

// WhatsApp connect (triggers connection + QR code generation)
app.post('/api/whatsapp/connect', async (_, res) => {
  try {
    await whatsapp.listChats(1);
    res.json({ result: 'Connection triggered. Open /api/whatsapp/qr to see the QR code.' });
  } catch (e) {
    res.json({ result: `Connection triggered. Open /api/whatsapp/qr to scan.` });
  }
});

// ─── Auth Routes ────────────────────────────────────────────────────────────
const { register, login } = require('./auth');

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    const result = register(username, password);
    res.json({ result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const result = login(username, password);
    res.json({ result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ result: { id: req.user.userId, username: req.user.username } });
});

// ─── Storage Routes (protected) ─────────────────────────────────────────────
app.use('/api/storage', storageRouter);

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', os: process.platform }));

// 404 handler — return JSON, not HTML
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — return JSON always
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Nexu server running on http://localhost:${PORT}`);
  console.log('Tools available: system, files, browser, pdf, extra, whatsapp, auth');
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error('   Kill the old process first:');
    console.error('   PowerShell: Get-Process -Name node | Stop-Process -Force');
    console.error('   Then restart the server.\n');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
