const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', 'sessions', 'whatsapp');
const DATA_FILE = path.join(SESSION_DIR, 'data.json');
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

// Contact store from Baileys contacts.upsert event
// { jid: { id, name, notify, verifiedName } }
let _contacts = {};

// History sync tracking — set to true after messaging-history.set fires
let _historySynced = false;


// ─── State persistence ──────────────────────────────────────────────────────
// Persist _chats and _contacts to disk so they survive server restarts.
// On reconnect with saved auth, messaging-history.set doesn't fire again,
// so without this the in-memory stores would stay empty forever.

let _saveTimeout = null;

function saveState() {
  try {
    ensureSessionDir();
    const data = {
      chats: _chats,
      contacts: _contacts,
      savedAt: Date.now(),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.error('Failed to save WhatsApp state:', e.message);
  }
}

function saveStateDebounced() {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(saveState, 2000);
}

function loadState() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (data.chats && Array.isArray(data.chats)) {
      _chats = data.chats;
    }
    if (data.contacts && typeof data.contacts === 'object') {
      _contacts = data.contacts;
    }
    if (_chats.length > 0 || Object.keys(_contacts).length > 0) {
      _nameMapDirty = true;
      console.log(`📦 Restored WhatsApp state: ${_chats.length} chats, ${Object.keys(_contacts).length} contacts`);
    }
  } catch (e) {
    console.error('Failed to load WhatsApp state:', e.message);
  }
}

// Load persisted state on module load
loadState();

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureSessionDir() {
  try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch { /* ignore */ }
}

function formatJid(jid) {
  if (!jid) return '';
  if (jid.endsWith('@g.us')) return jid.split('@')[0];
  const number = jid.split('@')[0];
  // Just prepend + to the full number (handles any length correctly)
  if (number.length >= 7) return `+${number}`;
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
  const name = chat.name || chat.subject || getChatName(chat.id);
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
  const senderJid = msg.key?.participant || msg.key?.remoteJid;
  const sender = fromMe ? 'You' : (msg.pushName || getChatName(senderJid));
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
  // Check contact name from Baileys store (saved WhatsApp contact names)
  const contact = _contacts[jid];
  if (contact) {
    if (contact.name) return contact.name;
    if (contact.notify) return contact.notify;
    if (contact.verifiedName) return contact.verifiedName;
  }
  // Try to get pushName from the most recent message from the contact
  const msgs = _messages[jid] || [];
  for (const msg of msgs) {
    if (!msg.key?.fromMe && msg.pushName) return msg.pushName;
  }
  return formatJid(jid);
}

/**
 * Build a map of names -> jid from ALL available sources:
 * - Message push names
 * - Contact name/notify from Baileys contacts.upsert
 * - Chat name/subject
 * Used to resolve contact names to JIDs.
 */
function buildNameToJidMap() {
  if (!_nameMapDirty) return _nameMapCache;
  _nameMapCache = {};

  // 1. Message push names (contact's displayed name on their messages)
  for (const [jid, msgs] of Object.entries(_messages)) {
    for (const msg of msgs) {
      if (!msg.key?.fromMe && msg.pushName) {
        const name = msg.pushName.toLowerCase().trim();
        if (name && !_nameMapCache[name]) _nameMapCache[name] = jid;
      }
    }
  }

  // 2. Contact names from Baileys contacts.upsert
  for (const [jid, contact] of Object.entries(_contacts)) {
    const names = [contact.name, contact.notify, contact.verifiedName].filter(Boolean);
    for (const n of names) {
      const lower = n.toLowerCase().trim();
      if (lower && !_nameMapCache[lower]) _nameMapCache[lower] = jid;
    }
  }

  // 3. Chat names/subjects
  for (const chat of _chats) {
    const name = chat.name || chat.subject;
    if (name) {
      const lower = name.toLowerCase().trim();
      if (lower && !_nameMapCache[lower]) _nameMapCache[lower] = chat.id;
    }
  }

  _nameMapDirty = false;
  if (Object.keys(_nameMapCache).length > 0) {
    console.log(`📖 Name map built: ${Object.keys(_nameMapCache).length} entries`);
  }
  return _nameMapCache;
}

// ─── Fuzzy string matching ────────────────────────────────────────────────
// Levenshtein distance: minimum single-character edits to go from a to b
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Similarity score from 0 (completely different) to 1 (exact match)
function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  const dist = levenshtein(al, bl);
  const maxLen = Math.max(al.length, bl.length);
  return 1 - (dist / maxLen);
}

// Find contacts with names similar to the search term across all sources
function findSimilarNames(searchTerm, maxResults = 3) {
  const results = [];
  const checked = new Set();  // avoid duplicate JIDs

  const addIfSimilar = (name, jid) => {
    if (!name || checked.has(jid)) return;
    const sim = stringSimilarity(searchTerm, name);
    if (sim >= 0.3) {
      results.push({ name: name.trim(), jid, similarity: sim });
      checked.add(jid);
    }
  };

  // Check _contacts (saved WhatsApp contact names — most reliable source)
  for (const [jid, c] of Object.entries(_contacts)) {
    for (const n of [c.name, c.notify, c.verifiedName].filter(Boolean)) {
      addIfSimilar(n, jid);
    }
  }

  // Check _chats (chat names/subjects)
  for (const chat of _chats) {
    const name = chat.name || chat.subject;
    if (name) addIfSimilar(name, chat.id);
  }

  // Check nameMap (message pushNames)
  const nameMap = buildNameToJidMap();
  for (const [name, jid] of Object.entries(nameMap)) {
    addIfSimilar(name, jid);
  }

  // Sort by similarity (closest first), take top results
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
}

/**
 * Resolve a contact name or phone number to a WhatsApp JID.
 * Checks in order: direct JID, phone number, contacts, chats, pushNames.
 * If no match found, searches for similar names via fuzzy matching.
 */
async function resolveJid(contactNameOrNumber) {
  if (contactNameOrNumber.includes('@')) return contactNameOrNumber;
  const digits = contactNameOrNumber.replace(/[^0-9]/g, '');

  // Phone number validation — require country code
  if (digits.length >= 7) {
    if (digits.length <= 10) {
      // 7-10 digits — likely missing country code.
      // WhatsApp requires the full number with country code.
      throw new Error(
        `"${contactNameOrNumber}" looks like it's missing the country code. ` +
        `WhatsApp requires the full number with country code. ` +
        `Example: +977${digits} (977 is Nepal's country code). ` +
        `Always include the + prefix and country code.`
      );
    }
    // 11-15 digits — has country code, proceed
    return `${digits}@s.whatsapp.net`;
  }
  
  const lowerSearch = contactNameOrNumber.toLowerCase();

  // Search _contacts store first (saved contact names from Baileys)
  const contactMatch = Object.entries(_contacts).find(([jid, c]) => {
    const names = [c.name, c.notify, c.verifiedName].filter(Boolean);
    return names.some(n => n.toLowerCase().includes(lowerSearch));
  });
  if (contactMatch) return contactMatch[0];

  // Search by chat name/subject
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

  // ─── Fuzzy fallback: no exact match, search for similar names ─────────
  const similar = findSimilarNames(contactNameOrNumber, 3);
  if (similar.length > 0) {
    const suggestions = similar.map((s) => `   • ${s.name}`).join('\n');
    throw new Error(
      `Could not find "${contactNameOrNumber}" in your contacts.` +
      `\nDid you mean?\n${suggestions}` +
      `\n\nSay the exact name to send the message.`
    );
  }

  throw new Error(
    `Could not find "${contactNameOrNumber}" in your WhatsApp contacts. ` +
    `Try sending to their phone number directly with the country code.`
  );
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
  _latestQRImage = null;    try {
      ensureSessionDir();
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

      // If we have no cached chats (server restart / first time with persistence),
      // force Baileys to do a full history sync by resetting accountSyncCounter.
      // Without this, Baileys skips messaging-history.set on reconnect with saved
      // auth (accountSyncCounter > 0), leaving _chats and _contacts empty forever.
      if (_chats.length === 0 && state.creds?.accountSyncCounter > 0) {
        console.log('📜 Forcing full history sync — no cached chat data available');
        state.creds.accountSyncCounter = 0;
      }

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
      saveStateDebounced();
    });

    // ── Event: Contact names from WhatsApp address book ──
    // This fires when contacts are loaded or updated.
    // `name` is the contact's self-set profile name, which may differ
    // from what the user saved in their phone.
    sock.ev.on('contacts.upsert', (newContacts) => {
      for (const c of newContacts) {
        _contacts[c.id] = c;
        // Also add to name map for name resolution
        if (c.name || c.notify) {
          _nameMapDirty = true;
        }
      }
      saveStateDebounced();
    });

    // ── Event: Chat updates ──
    sock.ev.on('chats.update', (updates) => {
      for (const update of updates) {
        const idx = _chats.findIndex(c => c.id === update.id);
        if (idx >= 0) _chats[idx] = { ..._chats[idx], ...update };
      }
      saveStateDebounced();
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
    // This fires once when the initial history sync completes.
    // It includes ALL chats, contacts, and messages.
    sock.ev.on('messaging-history.set', ({ chats, contacts, messages: historyMessages, isLatest }) => {
      console.log(`📜 History sync received: ${chats.length} chats, ${contacts?.length || 0} contacts, ${historyMessages.length} messages (isLatest: ${isLatest})`);

      // Add all history chats to our in-memory store
      for (const chat of chats) {
        const idx = _chats.findIndex(c => c.id === chat.id);
        if (idx >= 0) _chats[idx] = { ..._chats[idx], ...chat };
        else _chats.push(chat);
      }

      // CRITICAL: Process contacts from history sync — this is where
      // WhatsApp-saved contact names (name, notify, etc.) come from.
      // Without this, _contacts stays empty and name resolution fails.
      if (contacts) {
        if (Array.isArray(contacts)) {
          for (const c of contacts) {
            if (c?.id) {
              _contacts[c.id] = { ..._contacts[c.id], ...c };
            }
          }
        } else if (typeof contacts === 'object') {
          // Some Baileys versions pass contacts as an object/map
          for (const [jid, c] of Object.entries(contacts)) {
            if (c && typeof c === 'object') {
              _contacts[jid] = { ..._contacts[jid], ...c };
            }
          }
        }
      }

      // Add all history messages to our in-memory store
      for (const msg of historyMessages) {
        const jid = msg.key?.remoteJid;
        if (!jid) continue;
        if (!_messages[jid]) _messages[jid] = [];
        const exists = _messages[jid].some(m => m.key?.id === msg.key?.id);
        if (!exists) _messages[jid].push(msg);
        if (_messages[jid].length > 200) _messages[jid].splice(0, _messages[jid].length - 200);
      }

      _nameMapDirty = true;
      _historySynced = true;
      clearTimeout(_saveTimeout);
      saveState();
      console.log(`✅ History processed: ${_chats.length} chats, ${Object.keys(_messages).length} threads, ${Object.keys(_contacts).length} contacts`);
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
          _contacts = {};
          _nameMapCache = {};
          _nameMapDirty = true;
          _historySynced = false;
        } else if (_connectionAttempts <= MAX_RETRIES) {
          // Exponential backoff: 5s, 10s, 20s between retries
          const backoff = Math.min(5000 * Math.pow(2, _connectionAttempts - 1), 20000);
          console.log(`\n⚠️ WhatsApp disconnected. Reconnecting in ${backoff/1000}s (${_connectionAttempts}/${MAX_RETRIES})...\n`);
          setTimeout(() => { _connecting = false; connect().catch(() => {}); }, backoff);
        } else {
          console.log('\n❌ WhatsApp: Max reconnection attempts reached. Start a new WhatsApp tool request to reconnect.\n');
        }
      }
    });

    _sock = sock;

    // Wait up to 60s for connection to open.
    // Reject on timeout so callers know the connection never established.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for WhatsApp connection.'));
      }, 60000);
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
  // connect() now rejects on timeout if the connection never opens.
  // This ensures callers don't proceed with a dead connection.
  return await connect();
}

// ─── Tool Functions ─────────────────────────────────────────────────────────

async function listChats(limit = 10) {
  try {
    await ensureConnection();

    // Wait for history sync to populate chats.
    // First phase: wait up to 30s for the history sync event to fire.
    // Second phase: if synced but still no chats, wait a bit more for upsert.
    let filtered = _chats.filter(c => !c.id?.includes('status@broadcast'));
    
    if (filtered.length === 0) {
      // Phase 1: Wait for history sync to complete (20 * 1.5s = 30s)
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1500));
        filtered = _chats.filter(c => !c.id?.includes('status@broadcast'));
        if (filtered.length > 0 || _historySynced) break;
      }

      // If Phase 1 timed out but we're actually connected, the
      // messaging-history.set event never fired (reconnect with saved auth).
      // Mark sync as done and let Phase 2 pick up chats from upsert events.
      if (!_historySynced && _connected) {
        _historySynced = true;
      }
    }
    
    // Phase 2: If sync completed but chats still empty, wait for upsert
    if (filtered.length === 0 && _historySynced) {
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 1000));
        filtered = _chats.filter(c => !c.id?.includes('status@broadcast'));
        if (filtered.length > 0) break;
      }
    }

    if (filtered.length === 0) {
      if (!_historySynced) {
        return '⏳ WhatsApp history sync is still in progress. This can take up to a minute for large accounts. Try asking again in a few seconds.';
      }
      return '✅ WhatsApp is connected and synced, but no chats were found. If you have chats on your phone, try sending a message from your phone first, then list chats again.';
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

    // Verify connection is really alive before attempting to send
    if (!_connected) {
      return `⚠️ WhatsApp is not connected. Current status: ${getStatus()}. Try again once connected.`;
    }

    // Resolve contact with a clear error if not found
    let jid;
    try {
      jid = await resolveJid(to);
    } catch (resolveErr) {
      // The resolveJid error already says 'Could not resolve ...' which is clear enough
      return `❌ ${resolveErr.message}`;
    }

    if (!message || !message.trim()) return 'Cannot send an empty message.';
    const trimmed = message.trim().substring(0, 4096);

    await sock.sendMessage(jid, { text: trimmed });

    // Small wait to catch any connection drops during the send
    // Baileys resolves sendMessage as soon as the message is queued on the WebSocket,
    // but delivery requires the connection to stay alive.
    await new Promise(r => setTimeout(r, 300));

    if (!_connected) {
      return `⚠️ Message queued but connection dropped during delivery. The message may not have been received. Try checking with your contact or checking connection status.`;
    }

    const contactName = getChatName(jid);
    return `✅ Message sent to ${contactName} (${formatJid(jid)}): "${trimmed.substring(0, 200)}${trimmed.length > 200 ? '...' : ''}"`;
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
      const name = chat.name || chat.subject || getChatName(chat.id);
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
    _contacts = {};
    _nameMapCache = {};
    _nameMapDirty = true;
    _historySynced = false;
    // Delete session files and saved state
    if (fs.existsSync(SESSION_DIR)) {
      const files = fs.readdirSync(SESSION_DIR);
      for (const f of files) fs.unlinkSync(path.join(SESSION_DIR, f));
      // Also delete the data file if it exists
      try { if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE); } catch { /* ignore */ }
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
