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
app.post('/api/system/launch', (req, res) => res.json({ result: system.launchApp(req.body.name, req.body.profile) }));

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

// ─── Chat endpoint (autonomous agent loop) ─────────────────────────────────
// The frontend sends conversation + API keys, and this endpoint runs an
// autonomous loop: call LLM → parse tool calls → execute tools → loop back
// to LLM → repeat until the LLM returns pure text (no tool calls).
// Max 10 iterations safety cap prevents runaway loops.
const { getDb, generateId } = require('./db');

app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { messages, groqApiKey, geminiApiKey, nvidiaApiKey, nvidiaModel, openRouterApiKey, provider, localEndpoint, localModel, localApiKey, groqModel, geminiModel, openRouterModel } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Extract system prompt from messages (first message with role 'system')
    let systemPrompt = '';
    const conversation = messages.filter(m => {
      if (m.role === 'system') {
        systemPrompt = m.content;
        return false;
      }
      return m.role !== 'tool';
    });

    if (!systemPrompt) {
      return res.status(400).json({ error: 'System prompt is required as first message with role "system"' });
    }

    // ─── LLM providers ──────────────────────────────────────────────────
    async function callGroq(msgs, apiKey) {
      const model = groqModel || 'llama-3.3-70b-versatile';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Groq API error (${r.status}): ${err}`);
      }
      const data = await r.json();
      return data.choices[0].message.content;
    }

    async function callNvidia(msgs, apiKey, model) {
      const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model || 'deepseek-ai/deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            ...msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`NVIDIA NIM API error (${r.status}): ${err}`);
      }
      const data = await r.json();
      return data.choices[0].message.content;
    }

    async function callOpenRouter(msgs, apiKey) {
      const model = openRouterModel || 'deepseek/deepseek-chat';
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://nexu.app',
          'X-Title': 'Nexu',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`OpenRouter API error (${r.status}): ${err}`);
      }
      const data = await r.json();
      return data.choices[0].message.content;
    }



    async function callGemini(msgs, apiKey) {
      const model = geminiModel || 'gemini-2.0-flash';
      const history = msgs.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const lastMsg = msgs[msgs.length - 1];
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            ...history,
            { role: lastMsg.role === 'assistant' ? 'model' : 'user', parts: [{ text: lastMsg.content }] },
          ],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Gemini API error (${r.status}): ${err}`);
      }
      const data = await r.json();
      return data.candidates[0].content.parts[0].text;
    }

    // ─── Tool call parsing ──────────────────────────────────────────────
    function parseToolCalls(text) {
      const calls = [];
      const parts = text.split('---TOOL---');
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.startsWith('{')) {
          // Extract JSON object using brace matching to handle
          // trailing text like '---' that the LLM sometimes adds.
          let depth = 0;
          let jsonStart = -1;
          for (let j = 0; j < part.length; j++) {
            if (part[j] === '{') {
              if (depth === 0) jsonStart = j;
              depth++;
            } else if (part[j] === '}') {
              depth--;
              if (depth === 0 && jsonStart >= 0) {
                const jsonStr = part.substring(jsonStart, j + 1);
                try { calls.push(JSON.parse(jsonStr)); }
                catch { /* skip invalid JSON */ }
                jsonStart = -1;
              }
            }
          }
        }
      }
      return calls;
    }

    // ─── Server-side tool registry ──────────────────────────────────────
    const TOOL_PARAM_KEYS = {
      get_battery: [], get_cpu: [], get_ram: [],
      set_volume: ['level'], notify: ['title', 'message'],
      run_command: ['command'], launch_app: ['name', 'profile'],
      lock_workstation: [], sleep: [], shutdown: [], hibernate: [],
      open_file: ['path'], open_in_vscode: ['path'],
      search_files: ['query', 'location'], find_file: ['filename'],
      get_file_info: ['path'], list_directory: ['path'],
      read_pdf: ['path'],
      browser_launch: [], browser_close: [],
      open_url: ['url', 'maxParagraphs', 'maxChars'],
      search_web: ['query', 'maxParagraphs', 'maxChars'],
      browser_navigate: ['url'], browser_snapshot: [], browser_get_text: [],
      browser_act: ['refId', 'do', 'value'],
      browser_act_and_wait: ['refId', 'do', 'value'],
      browser_extract_text: ['selector'], browser_screenshot: [],
      clipboard_read: [], clipboard_copy: ['text'],
      screenshot: [], play_youtube: ['query'],
      remember: ['key', 'value'], recall: ['key'],
      list_facts: [], forget: ['key'],
      search_memory: ['query'],
      list_whatsapp_chats: ['limit'],
      get_whatsapp_messages: ['chat', 'limit'],
      send_whatsapp: ['to', 'message'],
      get_unread_whatsapp: [],
      whatsapp_status: [],
      whatsapp_qr: [],
      whatsapp_clear_session: [],
      whatsapp_block: ['contact'],
      whatsapp_unblock: ['contact'],
      whatsapp_delete_chat: ['contact'],
      whatsapp_archive: ['contact'],
      whatsapp_unarchive: ['contact'],
      whatsapp_mute: ['contact', 'duration'],
      whatsapp_unmute: ['contact'],
      whatsapp_pin: ['contact'],
      whatsapp_unpin: ['contact'],
      whatsapp_mark_read: ['contact'],
      whatsapp_report: ['contact'],
    };

    const toolRegistry = {
      // System
      get_battery: system.getBattery, get_cpu: system.getCpu,
      get_ram: system.getRam, set_volume: (l) => system.setVolume(l),
      notify: (t, m) => system.notify(t, m),
      run_command: (c) => system.runCommand(c),
      launch_app: (n, p) => system.launchApp(n, p),
      lock_workstation: system.lockWorkstation, sleep: system.sleep,
      shutdown: system.shutdown, hibernate: system.hibernate,
      // Files
      open_file: (p) => files.openFile(p),
      open_in_vscode: (p) => files.openInVscode(p),
      search_files: (q, l) => files.searchFiles(q, l),
      find_file: (f) => files.findFile(f),
      get_file_info: (p) => files.getFileInfo(p),
      list_directory: (p) => files.listDirectory(p),
      // PDF
      read_pdf: (p) => pdf.readPdf(p),
      // Browser
      browser_launch: browser.launch, browser_close: browser.close,
      open_url: (u, mp, mc) => browser.openUrl(u, mp, mc),
      search_web: (q, mp, mc) => browser.searchWeb(q, mp, mc),
      browser_navigate: (u) => browser.navigate(u),
      browser_snapshot: browser.snapshot, browser_get_text: browser.getPageText,
      browser_act: (r, d, v) => browser.act(r, d, v),
      browser_act_and_wait: (r, d, v) => browser.actAndWait(r, d, v),
      browser_extract_text: (s) => browser.extractText(s),
      browser_screenshot: browser.screenshot,
      // Extra
      clipboard_read: extra.clipboardRead,
      clipboard_copy: (t) => extra.clipboardCopy(t),
      screenshot: extra.screenshot,
      play_youtube: (q) => extra.playYoutube(q),
      // Memory tools (direct DB access)
      remember: (key, value) => {
        const db = getDb();
        const k = String(key).toLowerCase();
        const existing = db.prepare('SELECT id FROM facts WHERE user_id = ? AND key = ?').get(req.user.userId, k);
        if (existing) {
          db.prepare('UPDATE facts SET value = ?, category = ?, timestamp = datetime("now") WHERE id = ?').run(String(value), 'user_chat', existing.id);
        } else {
          db.prepare('INSERT INTO facts (id, user_id, key, value) VALUES (?, ?, ?, ?)').run(generateId(), req.user.userId, k, String(value));
        }
        return `Remembered: ${key} = ${value}`;
      },
      recall: (key) => {
        const db = getDb();
        const fact = db.prepare('SELECT value FROM facts WHERE user_id = ? AND key = ?').get(req.user.userId, String(key).toLowerCase());
        return fact ? String(fact.value) : `I don't have anything saved for '${key}'`;
      },
      list_facts: () => {
        const db = getDb();
        const facts = db.prepare('SELECT key, value FROM facts WHERE user_id = ? AND status = "saved"').all(req.user.userId);
        if (facts.length === 0) return 'No saved facts yet.';
        return facts.map(f => `${f.key}: ${f.value}`).join('\n');
      },
      forget: (key) => {
        const db = getDb();
        db.prepare('DELETE FROM facts WHERE user_id = ? AND key = ?').run(req.user.userId, String(key).toLowerCase());
        return `Forgot '${key}'`;
      },
      search_memory: (query) => {
        const db = getDb();
        const limit = 3;
        const results = db.prepare(
          'SELECT role, content, timestamp FROM history WHERE user_id = ? AND content LIKE ? ORDER BY timestamp DESC LIMIT ?'
        ).all(req.user.userId, `%${query}%`, limit).reverse();
        if (results.length === 0) return `No past conversations found matching '${query}'.`;
        return results.map(r => `[${r.timestamp}] ${r.role}: ${String(r.content).substring(0, 200)}`).join('\n');
      },
      // WhatsApp tools
      list_whatsapp_chats: (limit) => whatsapp.listChats(limit != null ? Number(limit) : 10),
      get_whatsapp_messages: (chat, limit) => whatsapp.getMessages(String(chat), limit != null ? Number(limit) : 10),
      send_whatsapp: (to, message) => whatsapp.sendMessage(String(to), String(message)),
      get_unread_whatsapp: () => whatsapp.getUnreadMessages(),
      whatsapp_status: () => whatsapp.getStatus(),
      whatsapp_qr: () => {
        const qr = whatsapp.getQR();
        if (qr.qrImage) {
          return '📱 Scan the QR code at http://localhost:3001/api/whatsapp/qr to link WhatsApp.';
        }
        return `No QR code available. Status: ${qr.connected ? 'Already connected' : 'Not connected yet.'}`;
      },
      whatsapp_clear_session: () => whatsapp.clearSession(),
      whatsapp_block: (contact) => whatsapp.blockContact(String(contact)),
      whatsapp_unblock: (contact) => whatsapp.unblockContact(String(contact)),
      whatsapp_delete_chat: (contact) => whatsapp.deleteChat(String(contact)),
      whatsapp_archive: (contact) => whatsapp.archiveChat(String(contact)),
      whatsapp_unarchive: (contact) => whatsapp.unarchiveChat(String(contact)),
      whatsapp_mute: (contact, duration) => whatsapp.muteChat(String(contact), String(duration || 'always')),
      whatsapp_unmute: (contact) => whatsapp.unmuteChat(String(contact)),
      whatsapp_pin: (contact) => whatsapp.pinChat(String(contact)),
      whatsapp_unpin: (contact) => whatsapp.unpinChat(String(contact)),
      whatsapp_mark_read: (contact) => whatsapp.markAsRead(String(contact)),
      whatsapp_report: (contact) => whatsapp.reportContact(String(contact)),
    };

    async function executeTool(call) {
      const { action, ...params } = call;
      const fn = toolRegistry[action];
      if (!fn) return `Unknown tool: ${action}`;
      try {
        const keys = TOOL_PARAM_KEYS[action] || Object.keys(params);
        const args = keys.map(k => params[k]);
        const result = await Promise.resolve(fn(...args));
        return String(result);
      } catch (e) {
        return `Error executing ${action}: ${e.message}`;
      }
    }

    // ─── WhatsApp intent detection ──────────────────────────────────────
    // Only use regex shortcut for phone NUMBER patterns (where it's reliable).
    // Contact NAMES fall through to the LLM auto-loop which is smarter about
    // resolving names, listing chats, and handling errors gracefully.
    const lastUserMsg = conversation[conversation.length - 1]?.content?.trim() || '';
    // Remove filler words that would confuse pattern matching
    const cleanMsg = lastUserMsg
      .replace(/^(hey|hi|yo|ok|okay|can you|could you|please|i need you to|i want you to)\s+/i, '')
      .replace(/\s+(please|thanks|thank you|for me|in whatsapp)$/i, '');

    // Only match when the target is clearly a phone number (has 7+ digits)
    // Contact names are left for the LLM auto-loop to handle
    const NUMBER_PATTERNS = [
      // "text/number/send the number X saying Y" where X has digits
      { re: /^(?:text|message|send)\s+(?:the\s+(?:contact|number)\s+)?(.+?)\s+(?:saying|that)\s+(.+)$/i },
      // "text X Y" where X has digits
      { re: /^text\s+(?:the\s+(?:contact|number)\s+)?([a-zA-Z0-9_ .+\-]+)\s+(.+)$/i },
    ];

    let waMatch = null;
    for (const { re } of NUMBER_PATTERNS) {
      const m = cleanMsg.match(re);
      if (m) {
        const to = m[1].trim();
        const digits = to.replace(/[^0-9]/g, '');
        // Only match if the target is a phone number (has 7+ digits)
        // This excludes contact names like "Batman" which have no digits
        if (digits.length >= 7) {
          waMatch = { to, message: m[2].trim() };
          break;
        }
      }
    }

    if (waMatch) {
      console.log(`📱 WhatsApp number shortcut: to="${waMatch.to}" (${waMatch.to.replace(/[^0-9]/g,'').length} digits)`);
      const result = await whatsapp.sendMessage(waMatch.to, waMatch.message);
      return res.json({
        result: {
          content: result,
          toolCalls: [{ action: 'send_whatsapp', params: waMatch, result }],
        },
      });
    }

    // ─── Auto-loop ──────────────────────────────────────────────────────
    let currentMessages = [...conversation];
    const allToolCalls = [];

    // Track the previous iteration's tool calls so we can detect if the LLM
    // gets stuck calling the same tool repeatedly across consecutive iterations.
    let lastIterationCalls = null;

    // Determine the LLM provider once before the loop — all iterations
    // within a single request use the same provider. On 'auto', try Groq
    // first, fall back to Gemini, then OpenRouter, then NVIDIA, then local.
    let useGemini = provider === 'gemini';
    let useGroq = provider === 'groq';
    let useOpenRouter = provider === 'openrouter';
    let useNvidia = provider === 'nvidia';
    let useLocal = provider === 'local';
    if (provider === 'auto') {
      useGroq = !!groqApiKey;
      useGemini = !useGroq && !!geminiApiKey;
      useOpenRouter = !useGroq && !useGemini && !!openRouterApiKey;
      useNvidia = !useGroq && !useGemini && !useOpenRouter && !!nvidiaApiKey;
      useLocal = !useGroq && !useGemini && !useOpenRouter && !useNvidia;
    }
    if (!useGroq && !useGemini && !useOpenRouter && !useNvidia && !useLocal) {
      throw new Error('No API key configured for the selected provider');
    }

    async function callLocal(msgs, endpoint, model, key) {
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = `Bearer ${key}`;
      const r = await fetch(endpoint || 'http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model || 'local-model',
          messages: [
            { role: 'system', content: systemPrompt },
            ...msgs.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Local AI error (${r.status}): ${err}`);
      }
      const data = await r.json();
      return data.choices[0].message.content;
    }

    for (let iteration = 0; iteration < 10; iteration++) {
      let rawResponse;

      if (useGemini) {
        rawResponse = await callGemini(currentMessages, geminiApiKey);
      } else if (useOpenRouter) {
        rawResponse = await callOpenRouter(currentMessages, openRouterApiKey);
      } else if (useNvidia) {
        rawResponse = await callNvidia(currentMessages, nvidiaApiKey, nvidiaModel);
      } else if (useLocal) {
        rawResponse = await callLocal(currentMessages, localEndpoint, localModel, localApiKey);
      } else {
        rawResponse = await callGroq(currentMessages, groqApiKey);
      }

      const toolCalls = parseToolCalls(rawResponse);
      const text = rawResponse.split('---TOOL---')[0].trim();

      if (toolCalls.length === 0) {
        // Pure text — done
        return res.json({
          result: {
            content: text || rawResponse.trim(),
            toolCalls: allToolCalls,
          },
        });
      }

      // Deduplicate tool calls within this iteration
      const seenCalls = new Set();
      const uniqueCalls = [];
      for (const call of toolCalls) {
        const key = JSON.stringify(call);
        if (!seenCalls.has(key)) {
          seenCalls.add(key);
          uniqueCalls.push(call);
        }
      }

      // Track the call keys for this iteration (used to detect consecutive dupes)
      const currentIterationKeys = uniqueCalls.map(c => JSON.stringify(c));

      // If this iteration's tool calls are IDENTICAL to the previous iteration's,
      // the LLM is stuck in a loop (e.g. calling play_youtube with the same query
      // over and over). Break out and return just the text portion.
      // Only checks CONSECUTIVE iterations, so snapshot -> act -> snapshot works fine.
      if (lastIterationCalls !== null &&
          currentIterationKeys.length === lastIterationCalls.length &&
          currentIterationKeys.every((key, i) => key === lastIterationCalls[i])) {
        return res.json({
          result: {
            content: text || 'Done.',
            toolCalls: allToolCalls,
          },
        });
      }
      lastIterationCalls = currentIterationKeys;

      // Execute each unique tool call
      for (const call of uniqueCalls) {
        const result = await executeTool(call);
        allToolCalls.push({ action: call.action, params: { ...call }, result });
        currentMessages.push({
          role: 'user',
          content: `[Tool: ${call.action}]
${result}`,
        });
      }

      // Loop back to LLM with tool results in context
    }

    // Max iterations reached
    return res.json({
      result: {
        content: 'Reached maximum tool execution iterations. Please try a simpler request.',
        toolCalls: allToolCalls,
      },
    });

  } catch (e) {
    console.error('Chat error:', e.message);
    res.status(500).json({ error: e.message });
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
