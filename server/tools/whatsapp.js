const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', 'sessions', 'whatsapp');
const MAX_MESSAGE_LENGTH = 3000;

let _sock = null;
let _connecting = false;
let _connected = false;
let _connectionAttempts = 0;
const MAX_RETRIES = 3;

// In-memory stores (populated by socket events)
let _chats = [];        // { id, name, subject, unreadCount, lastMessage, ... }
let _messages = {};      // { [jid]: [message, ...] }

// QR code state
let _latestQR = null;           // Raw QR string from Baileys
let _latestQRImage = null;      // Base64 data URL of the QR image (PNG)
let _qrGeneratedAt = null;      // Timestamp when QR was generated

// Name cache (pushName → jid)
let _nameMapCache = {};
let _nameMapDirty = true;

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureSessionDir() {
  try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch { /* ignore */ }
}

function formatJid(jid) {
  if (!jid) return '';
  if (jid.endsWith('@g.us')) return jid.split('@')[0];
  const number = jid.split('@')[0];
  if (number.length >= 10) return number.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 $2 $3');
  return number;
}

function extractMessageText(msg) {
  if (!msg?.message) return null;
  const { conversation, extendedTextMessage, imageMessage, videoMessage,
          documentMessage, audioMessage, voiceMessage, stickerMessage } = msg.message;
  if (conversation) return conversation;
  if (extendedTextMessage?.text) return extendedTextMessage.text;
  if (imageMessage?.caption) return `[Image] ${imageMessage.caption}`;
  if (videoMessage?.caption) return `[Video] ${videoMessage.caption}`;
  if (documentMessage?.fileName) return `[Document] ${documentMessage.fileName}`;
  if (audioMessage) return '[Audio]';
  if (voiceMessage) return '[Voice]';
  if (stickerMessage) return '[Sticker]';
  return '[Unsupported]';
}

function formatChat(chat) {
  const name = chat.name || chat.subject || formatJid(chat.id);
  const unreadCount = chat.unreadCount || 0;
  const lastMsg = chat.lastMessage ? extractMessageText(chat.lastMessage) : '';
  const lastTime = chat.lastMessage?.messageTimestamp
    ? new Date(chat.lastMessage.messageTimestamp * 1000).toLocaleString() : '';

  let result = `📱 ${name}`;
  if (unreadCount > 0) result += ` (${unreadCount} unread)`;
  if (lastMsg) result += `\n   Last: ${lastMsg.substring(0, 100)}`;
  if (lastTime) result += `\n   At: ${lastTime}`;
  return result;
}

function formatMessage(msg) {
  const fromMe = msg.key?.fromMe;
  const sender = fromMe ? 'You' : (msg.pushName || formatJid(msg.key?.participant || msg.key?.remoteJid));
  const text = extractMessageText(msg) || '[Deleted or unsupported]';
  const time = msg.messageTimestamp
    ? new Date(msg.messageTimestamp * 1000).toLocaleString() : '';
  const displayText = text.length > MAX_MESSAGE_LENGTH
    ? text.substring(0, MAX_MESSAGE_LENGTH) + '...' : text;
  return `[${time}] ${fromMe ? '→' : '←'} ${sender}: ${displayText}`;
}

/**
 * Get the display name for a chat JID.
 * Checks chat name/subject first, then falls back to message pushName, then formatted JID.
 */
function getChatName(jid) {
  const chat = _chats.find(c => c.id === jid);
  if (chat?.name) return chat.name;
  if (chat?.subject) return chat.subject;
  // Try to get pushName from the most recent message from the contact
  const msgs = _messages[jid] || [];
  for (const msg of msgs) {
    if (!msg.key?.fromMe && msg.pushName) return msg.pushName;
  }
  return formatJid(jid);
}

/**
 * Build a map of pushName -> jid from all stored messages.
 * Used to resolve contact names to JIDs.
 */
function buildNameToJidMap() {
  if (!_nameMapDirty) return _nameMapCache;
  _nameMapCache = {};
  for (const [jid, msgs] of Object.entries(_messages)) {
    for (const msg of msgs) {
      if (!msg.key?.fromMe && msg.pushName) {
        const name = msg.pushName.toLowerCase().trim();
        if (name && !_nameMapCache[name]) _nameMapCache[name] = jid;
      }
    }
  }
  _nameMapDirty = false;
  return _nameMapCache;
}

/**
 * Resolve a contact name or phone number to a WhatsApp JID.
 * Checks in order: direct JID, phone number, chat names, message pushNames.
 */
async function resolveJid(contactNameOrNumber) {
  if (contactNameOrNumber.includes('@')) return contactNameOrNumber;
  const digits = contactNameOrNumber.replace(/[^0-9]/g, '');
  if (digits.length >= 7 && digits.length <= 15) return `${digits}@s.whatsapp.net`;
  
  // Search by chat name/subject
  const lowerSearch = contactNameOrNumber.toLowerCase();
  const chatMatch = _chats.find(c => {
    const name = (c.name || c.subject || '').toLowerCase();
    return name.includes(lowerSearch);
  });
  if (chatMatch) return chatMatch.id;

  // Search by message pushName (contact's display name)
  const nameMap = buildNameToJidMap();
  const pushNameMatch = Object.keys(nameMap).find(k => k.includes(lowerSearch) || lowerSearch.includes(k));
  if (pushNameMatch) return nameMap[pushNameMatch];

  if (digits) return `${digits}@s.whatsapp.net`;
  throw new Error(`Could not resolve "${contactNameOrNumber}". Try using the phone number with country code.`);
}

// Generate QR image from the raw QR string using qrcode library
async function generateQRImage(qrString) {
  try {
    _latestQRImage = await QRCode.toDataURL(qrString, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a23', light: '#ffffff' },
    });
    _qrGeneratedAt = Date.now();
  } catch (e) {
    console.error('Failed to generate QR image:', e.message);
    _latestQRImage = null;
  }
}

// ─── Connection ─────────────────────────────────────────────────────────────

async function connect() {
  if (_sock && _connected) {
    // Already connected — clear any stale QR
    _latestQR = null;
    _latestQRImage = null;
    return _sock;
  }
  if (_connecting) {
    while (_connecting) await new Promise(r => setTimeout(r, 500));
    if (_sock && _connected) return _sock;
    throw new Error('WhatsApp connection failed. Try again or check the QR code.');
  }

  _connecting = true;
  _connectionAttempts++;

  // Clear previous QR when starting fresh connection
  _latestQR = null;
  _latestQRImage = null;

  try {
    ensureSessionDir();
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,  // Disable terminal QR — we show it in browser
      logger: require('pino')({ level: 'silent' }),
      browser: ['Nexu', 'Desktop', '1.0.0'],
      syncFullHistory: true,
      markOnlineOnConnect: true,
    });

    // ── Event: Save credentials ──
    sock.ev.on('creds.update', saveCreds);

    // ── Event: Incoming chats ──
    sock.ev.on('chats.upsert', (newChats) => {
      for (const chat of newChats) {
        const idx = _chats.findIndex(c => c.id === chat.id);
        if (idx >= 0) _chats[idx] = { ..._chats[idx], ...chat };
        else _chats.push(chat);
      }
    });

    // ── Event: Chat updates ──
    sock.ev.on('chats.update', (updates) => {
      for (const update of updates) {
        const idx = _chats.findIndex(c => c.id === update.id);
        if (idx >= 0) _chats[idx] = { ..._chats[idx], ...update };
      }
    });

    // ── Event: New messages ──
    sock.ev.on('messages.upsert', ({ messages: newMessages }) => {
      _nameMapDirty = true;
      for (const msg of newMessages) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
        if (!_messages[jid]) _messages[jid] = [];
        const exists = _messages[jid].some(m => m.key?.id === msg.key?.id);
        if (!exists) _messages[jid].push(msg);
        if (_messages[jid].length > 200) _messages[jid].splice(0, _messages[jid].length - 200);
      }
    });

    // ── Event: History sync (full history from initial connection) ──
    sock.ev.on('messaging-history.set', ({ chats, messages: historyMessages, isLatest }) => {
      console.log(`📜 History sync received: ${chats.length} chats, ${historyMessages.length} messages (isLatest: ${isLatest})`);

      // Add all history chats to our in-memory store
      for (const chat of chats) {
        const idx = _chats.findIndex(c => c.id === chat.id);
        if (idx >= 0) _chats[idx] = { ..._chats[idx], ...chat };
        else _chats.push(chat);
      }

      // Add all history messages to our in-memory store
      for (const msg of historyMessages) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
        if (!_messages[jid]) _messages[jid] = [];
        const exists = _messages[jid].some(m => m.key?.id === msg.key?.id);
        if (!exists) _messages[jid].push(msg);
      }

      _nameMapDirty = true;
      console.log(`✅ History processed: ${_chats.length} chats total, ${Object.keys(_messages).length} chat threads`);
    });

    // ── Event: Connection state ──
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // CAPTURE QR CODE and generate an image for the browser
      if (qr) {
        _latestQR = qr;
        await generateQRImage(qr);
        console.log('\n📱 WhatsApp QR code ready! Open http://localhost:3001/api/whatsapp/qr in your browser to scan.');
        console.log('   Phone: WhatsApp Settings → Linked Devices → Link a Device\n');
      }

      if (connection === 'open') {
        _connected = true;
        _connectionAttempts = 0;
        _latestQR = null;
        _latestQRImage = null;
        console.log('\n✅ WhatsApp connected!\n');
        try { sock.sendPresenceUpdate('available'); } catch { /* ignore */ }
      }

      if (connection === 'close') {
        _connected = false;
        _sock = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        if (isLoggedOut) {
          console.log('\n❌ WhatsApp logged out. Call a tool again to re-link.\n');
          try {
            const files = fs.readdirSync(SESSION_DIR);
            for (const f of files) fs.unlinkSync(path.join(SESSION_DIR, f));
          } catch { /* ignore */ }
          _chats = [];
          _messages = {};
          _latestQR = null;
          _latestQRImage = null;
        } else if (_connectionAttempts <= MAX_RETRIES) {
          console.log(`\n⚠️ WhatsApp disconnected. Reconnecting (${_connectionAttempts}/${MAX_RETRIES})...\n`);
          setTimeout(() => { _connecting = false; connect().catch(() => {}); }, 3000);
        } else {
          console.log('\n❌ WhatsApp: Max reconnection attempts reached. Call a tool to try again.\n');
        }
      }
    });

    _sock = sock;

    // Wait up to 60s for QR scan + history sync
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 60000);
      sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') { clearTimeout(timeout); resolve(); }
        if (update.lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
          clearTimeout(timeout);
          reject(new Error('Logged out. Session cleared. Try again.'));
        }
      });
    });

    return _sock;
  } catch (e) {
    _connecting = false;
    throw e;
  } finally {
    _connecting = false;
  }
}

async function ensureConnection() {
  if (_sock && _connected) return _sock;
  return await connect();
}

// ─── Tool Functions ─────────────────────────────────────────────────────────

async function listChats(limit = 10) {
  try {
    await ensureConnection();

    // Wait for history sync to populate chats (up to 12s)
    let filtered = _chats.filter(c => !c.id?.includes('status@broadcast'));
    if (filtered.length === 0) {
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1500));
        filtered = _chats.filter(c => !c.id?.includes('status@broadcast'));
        if (filtered.length > 0) break;
      }
    }

    if (filtered.length === 0) {
      return 'No chats found yet. The history sync might still be in progress (WhatsApp says "Syncing, keep app open"). Try asking again in a few seconds.';
    }

    const sorted = filtered
      .sort((a, b) => {
        const aTime = a.lastMessage?.messageTimestamp || 0;
        const bTime = b.lastMessage?.messageTimestamp || 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    let result = `📱 Recent WhatsApp Chats (${Math.min(limit, sorted.length)} of ${filtered.length}):\n\n`;
    result += sorted.map((chat, i) => `${i + 1}. ${formatChat(chat)}`).join('\n\n');
    return result;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to list chats: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function getMessages(chatNameOrId, limit = 10) {
  try {
    await ensureConnection();
    const jid = await resolveJid(chatNameOrId);
    await new Promise(r => setTimeout(r, 1000));

    const msgs = _messages[jid] || [];
    if (msgs.length === 0) {
      return `No messages yet for "${chatNameOrId}". Messages are shown as they arrive after connecting.`;
    }

    const sorted = msgs
      .filter(m => m.message)
      .sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0))
      .slice(-limit);

    const name = getChatName(jid);
    let result = `💬 Messages with ${name}:\n\n`;
    result += sorted.map(m => formatMessage(m)).join('\n');
    return result;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to get messages: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function sendMessage(to, message) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(to);
    if (!message || !message.trim()) return 'Cannot send an empty message.';
    const trimmed = message.trim().substring(0, 4096);
    await sock.sendMessage(jid, { text: trimmed });
    return `✅ Message sent to ${formatJid(jid)}: "${trimmed.substring(0, 200)}${trimmed.length > 200 ? '...' : ''}"`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to send: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function sendMessageByNumber(phoneNumber, message) {
  return await sendMessage(phoneNumber.replace(/[^0-9]/g, ''), message);
}

async function getUnreadMessages() {
  try {
    await ensureConnection();
    await new Promise(r => setTimeout(r, 1000));

    const unreadChats = _chats.filter(c => (c.unreadCount || 0) > 0 && !c.id?.includes('status@broadcast'));
    if (unreadChats.length === 0) return '📬 No unread messages. Inbox is clear!';

    let result = `📬 Unread Messages (${unreadChats.length} chats):\n\n`;
    for (const chat of unreadChats) {
      const name = chat.name || chat.subject || formatJid(chat.id);
      result += `📱 ${name} (${chat.unreadCount} unread)\n`;
      const msgs = (_messages[chat.id] || [])
        .filter(m => m.message && !m.key.fromMe)
        .sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0))
        .slice(-Math.min(chat.unreadCount || 3, 3));
      for (const msg of msgs) {
        const text = extractMessageText(msg) || '[Media]';
        result += `   ${text.substring(0, 150)}\n`;
      }
      result += '\n';
    }
    return result.trim();
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to get unread messages: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

function getStatus() {
  if (!_sock && !_connecting) {
    if (_latestQRImage) return '📱 QR code ready! Open the QR link in your browser to scan.';
    return '❌ Not connected. Try calling a WhatsApp tool to start connecting.';
  }
  if (_connecting) {
    if (_latestQRImage) return '⏳ Waiting for QR scan. Open the QR link in your browser.';
    return '⏳ Connecting...';
  }
  if (_connected) return '✅ Connected';
  return '⚠️ Disconnected. Call a tool to reconnect.';
}

/**
 * Get the current QR code image as a data URL (base64 PNG).
 * Returns null if no QR is available or already connected.
 */
function getQR() {
  return {
    qrImage: _latestQRImage,
    connected: _connected,
    connecting: _connecting,
    timestamp: _qrGeneratedAt,
  };
}

/**
 * Clear the WhatsApp session (logs out and removes saved auth).
 * Call this if you need to re-scan the QR code fresh.
 */
function clearSession() {
  try {
    // Close socket if connected
    if (_sock) {
      try { _sock.logout(); } catch { /* ignore */ }
      _sock = null;
    }
    _connected = false;
    _connecting = false;
    _chats = [];
    _messages = {};
    _latestQR = null;
    _latestQRImage = null;

    // Delete session files
    if (fs.existsSync(SESSION_DIR)) {
      const files = fs.readdirSync(SESSION_DIR);
      for (const f of files) fs.unlinkSync(path.join(SESSION_DIR, f));
      console.log('🗑️ WhatsApp session cleared');
    }
    return 'WhatsApp session cleared. Call a WhatsApp tool to re-link.';
  } catch (e) {
    return `Failed to clear session: ${e.message}`;
  }
}

// ─── Chat Management ─────────────────────────────────────────────────────────

async function blockContact(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.updateBlockStatus(jid, 'block');
    const name = getChatName(jid);
    return `🚫 Blocked ${name} (${formatJid(jid)}). They can no longer message you.`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to block contact: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function unblockContact(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.updateBlockStatus(jid, 'unblock');
    const name = getChatName(jid);
    return `✅ Unblocked ${name} (${formatJid(jid)}). They can message you again.`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to unblock contact: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function deleteChat(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    // Delete chat using the last message for reference
    const msgs = _messages[jid] || [];
    const lastMsg = msgs[msgs.length - 1];
    const lastMessages = lastMsg ? [{ id: lastMsg.key?.id, fromMe: lastMsg.key?.fromMe }] : [];
    await sock.chatModify({ delete: true, lastMessages }, jid);
    const name = getChatName(jid);
    // Remove from local cache
    _chats = _chats.filter(c => c.id !== jid);
    delete _messages[jid];
    _nameMapDirty = true;
    return `🗑️ Deleted chat with ${name} (${formatJid(jid)}).`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to delete chat: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function archiveChat(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.chatModify({ archive: true }, jid);
    const name = getChatName(jid);
    return `📦 Archived chat with ${name} (${formatJid(jid)}).`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to archive chat: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function unarchiveChat(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.chatModify({ archive: false }, jid);
    const name = getChatName(jid);
    return `📂 Unarchived chat with ${name} (${formatJid(jid)}).`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to unarchive chat: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function muteChat(contactNameOrNumber, duration = 'always') {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    let muteEnd = 0;
    switch (duration) {
      case '8hours':
        muteEnd = Math.floor(Date.now() / 1000) + 8 * 3600;
        break;
      case '1week':
        muteEnd = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
        break;
      case 'always':
      default:
        muteEnd = Math.floor(Date.now() / 1000) + 100 * 365 * 24 * 3600; // ~100 years
        break;
    }
    await sock.chatModify({ mute: muteEnd }, jid);
    const name = getChatName(jid);
    const durationLabel = duration === '8hours' ? '8 hours' : duration === '1week' ? '1 week' : 'always';
    return `🔇 Muted ${name} (${formatJid(jid)}) for ${durationLabel}.`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to mute chat: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function unmuteChat(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.chatModify({ mute: null }, jid);
    const name = getChatName(jid);
    return `🔊 Unmuted ${name} (${formatJid(jid)}). Notifications are back on.`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to unmute chat: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function pinChat(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.chatModify({ pin: true }, jid);
    const name = getChatName(jid);
    return `📌 Pinned ${name} (${formatJid(jid)}).`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to pin chat: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function unpinChat(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.chatModify({ pin: false }, jid);
    const name = getChatName(jid);
    return `📌 Unpinned ${name} (${formatJid(jid)}).`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to unpin chat: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function markAsRead(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    await sock.chatModify({ markRead: true }, jid);
    const name = getChatName(jid);
    // Update local unread count
    const chat = _chats.find(c => c.id === jid);
    if (chat) chat.unreadCount = 0;
    return `✅ Marked chat with ${name} (${formatJid(jid)}) as read.`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to mark as read: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

async function reportContact(contactNameOrNumber) {
  try {
    const sock = await ensureConnection();
    const jid = await resolveJid(contactNameOrNumber);
    const name = getChatName(jid);
    // WhatsApp Web API doesn't expose a report endpoint.
    // The best we can do is block and explain how to report manually.
    await sock.updateBlockStatus(jid, 'block');
    return `🚫 Blocked ${name} (${formatJid(jid)}).\n\n⚠️ WhatsApp's API doesn't support reporting contacts programmatically. To report ${name} to WhatsApp:\n1. Open WhatsApp on your phone\n2. Open the chat with ${name}\n3. Tap the contact name → Report Contact\n\nThey have been blocked in the meantime.`;
  } catch (e) {
    if (_latestQRImage && !_connected) {
      return `⚠️ Not connected. QR code ready — open http://localhost:3001/api/whatsapp/qr in your browser to scan.\n\nThen try again after scanning.`;
    }
    return `Failed to report contact: ${e instanceof Error ? e.message : 'Unknown error'}`;
  }
}

module.exports = {
  listChats,
  getMessages,
  sendMessage,
  sendMessageByNumber,
  getUnreadMessages,
  getStatus,
  getQR,
  clearSession,
  // New chat management
  blockContact,
  unblockContact,
  deleteChat,
  archiveChat,
  unarchiveChat,
  muteChat,
  unmuteChat,
  pinChat,
  unpinChat,
  markAsRead,
  reportContact,
};
