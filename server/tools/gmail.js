const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', 'sessions', 'gmail');
const TOKEN_FILE = path.join(SESSION_DIR, 'tokens.json');

// In-memory state
let _oauth2Client = null;
let _tokens = null;
let _connected = false;
let _authInProgress = false;
let _pendingClientId = null;
let _pendingClientSecret = null;

// ─── Token persistence ──────────────────────────────────────────────────────

function ensureSessionDir() {
  try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch { /* ignore */ }
}

function saveTokens(tokens) {
  try {
    ensureSessionDir();
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
    console.log('💾 Gmail tokens saved');
  } catch (e) {
    console.error('Failed to save Gmail tokens:', e.message);
  }
}

function loadTokens() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
    const tokens = JSON.parse(raw);
    console.log('📦 Gmail tokens restored from disk');
    return tokens;
  } catch (e) {
    console.error('Failed to load Gmail tokens:', e.message);
    return null;
  }
}

function deleteTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
      console.log('🗑️ Gmail tokens deleted');
    }
  } catch (e) {
    console.error('Failed to delete Gmail tokens:', e.message);
  }
}

// ─── OAuth2 helpers ─────────────────────────────────────────────────────────

function createOAuth2Client(clientId, clientSecret) {
  return new OAuth2Client(
    clientId,
    clientSecret,
    'http://localhost:3001/api/gmail/callback'
  );
}

function getAuthUrl(clientId, clientSecret) {
  const oauth2Client = createOAuth2Client(clientId, clientSecret);

  _pendingClientId = clientId;
  _pendingClientSecret = clientSecret;
  _authInProgress = true;

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    prompt: 'consent',
  });

  return url;
}

async function handleCallback(code) {
  if (!_pendingClientId || !_pendingClientSecret) {
    throw new Error('No pending Gmail authorization. Start the connection flow again.');
  }

  const oauth2Client = createOAuth2Client(_pendingClientId, _pendingClientSecret);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    _tokens = tokens;
    _oauth2Client = oauth2Client;
    _oauth2Client.setCredentials(tokens);
    _connected = true;
    _authInProgress = false;

    saveTokens({
      ...tokens,
      _clientId: _pendingClientId,
      _clientSecret: _pendingClientSecret,
    });

    _pendingClientId = null;
    _pendingClientSecret = null;

    console.log('✅ Gmail connected successfully');
    return tokens;
  } catch (e) {
    _authInProgress = false;
    _pendingClientId = null;
    _pendingClientSecret = null;
    throw new Error(`Gmail OAuth callback failed: ${e.message}`);
  }
}

function restoreFromSavedTokens() {
  const saved = loadTokens();
  if (!saved) return false;

  const clientId = saved._clientId;
  const clientSecret = saved._clientSecret;
  if (!clientId || !clientSecret) {
    console.log('⚠️ Saved Gmail tokens missing client credentials — re-auth needed');
    deleteTokens();
    return false;
  }

  try {
    const oauth2Client = createOAuth2Client(clientId, clientSecret);
    oauth2Client.setCredentials(saved);
    _tokens = saved;
    _oauth2Client = oauth2Client;
    _connected = true;
    console.log('🔁 Gmail connection restored from saved tokens');
    return true;
  } catch (e) {
    console.error('Failed to restore Gmail connection:', e.message);
    deleteTokens();
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

function getStatus() {
  if (_connected) return '✅ Connected to Gmail';
  if (_authInProgress) return '⏳ Waiting for you to authorize in the browser...';
  return '❌ Not connected to Gmail';
}

function getAuthState() {
  return {
    connected: _connected,
    authInProgress: _authInProgress,
  };
}

async function disconnect() {
  if (_oauth2Client && _tokens?.access_token) {
    try {
      await _oauth2Client.revokeToken(_tokens.access_token);
      console.log('🔌 Gmail token revoked');
    } catch (e) {
      console.warn('Could not revoke Gmail token:', e.message);
    }
  }

  _oauth2Client = null;
  _tokens = null;
  _connected = false;
  _authInProgress = false;
  _pendingClientId = null;
  _pendingClientSecret = null;
  deleteTokens();

  return 'Gmail disconnected. All tokens cleared.';
}

restoreFromSavedTokens();

// ─── Gmail API helpers ──────────────────────────────────────────────────────

function getGmailClient() {
  if (!_connected || !_oauth2Client) {
    throw new Error('Not connected to Gmail. Go to Connections page and connect first.');
  }
  return google.gmail({ version: 'v1', auth: _oauth2Client });
}

/**
 * Convert HTML to plain text — handles newsletters, styled emails, etc.
 */
function htmlToText(html) {
  if (!html || typeof html !== 'string') return '';

  // Decode common HTML entities first
  let text = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#\d+;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&zwnj;/g, '')
    .replace(/&zwj;/g, '');

  // Remove style and script blocks
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Replace common block elements with newlines
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<li[^>]*>/gi, '  • ')
    .replace(/<td[^>]*>/gi, ' ')
    .replace(/<th[^>]*>/gi, ' ');

  // Replace links: keep the text, note the URL
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, linkText) => {
    const txt = linkText.replace(/<[^>]*>/g, '').trim();
    if (txt && txt !== url) return `${txt} (${url})`;
    return txt || url;
  });

  // Remove image tags (keep alt text)
  text = text.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, (match, alt) => alt || '');
  text = text.replace(/<img[^>]*>/gi, '');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode any remaining named HTML entities
  text = text.replace(/&([a-zA-Z]+);/g, (match, entity) => {
    const entities = {
      // Basic
      'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'",
      // Spaces & dashes
      'nbsp': ' ', 'ensp': ' ', 'emsp': ' ', 'thinsp': ' ', 'zwnj': '', 'zwj': '',
      'mdash': '—', 'ndash': '–', 'horbar': '―',
      // Quotes
      'lsquo': "'", 'rsquo': "'", 'sbquo': "'", 'ldquo': '"', 'rdquo': '"', 'bdquo': '"',
      'laquo': '«', 'raquo': '»',
      // Accented letters
      'agrave': 'à', 'aacute': 'á', 'acirc': 'â', 'atilde': 'ã', 'auml': 'ä', 'aring': 'å',
      'egrave': 'è', 'eacute': 'é', 'ecirc': 'ê', 'euml': 'ë',
      'igrave': 'ì', 'iacute': 'í', 'icirc': 'î', 'iuml': 'ï',
      'ograve': 'ò', 'oacute': 'ó', 'ocirc': 'ô', 'otilde': 'õ', 'ouml': 'ö',
      'ugrave': 'ù', 'uacute': 'ú', 'ucirc': 'û', 'uuml': 'ü',
      'ntilde': 'ñ', 'ccedil': 'ç',
      'Agrave': 'À', 'Aacute': 'Á', 'Acirc': 'Â', 'Atilde': 'Ã', 'Auml': 'Ä', 'Aring': 'Å',
      'Egrave': 'È', 'Eacute': 'É', 'Ecirc': 'Ê', 'Euml': 'Ë',
      'Igrave': 'Ì', 'Iacute': 'Í', 'Icirc': 'Î', 'Iuml': 'Ï',
      'Ograve': 'Ò', 'Oacute': 'Ó', 'Ocirc': 'Ô', 'Otilde': 'Õ', 'Ouml': 'Ö',
      'Ugrave': 'Ù', 'Uacute': 'Ú', 'Ucirc': 'Û', 'Uuml': 'Ü',
      'Ntilde': 'Ñ', 'Ccedil': 'Ç',
      // Symbols
      'copy': '©', 'reg': '®', 'trade': '™', 'sect': '§', 'para': '¶',
      'deg': '°', 'plusmn': '±', 'sup2': '²', 'sup3': '³',
      'euro': '€', 'pound': '£', 'yen': '¥', 'cent': '¢', 'curren': '¤',
      'bull': '•', 'hellip': '…', 'prime': '′', 'Prime': '″',
      'dagger': '†', 'Dagger': '‡',
      'permil': '‰', 'micro': 'µ', 'middot': '·',
      'larr': '←', 'rarr': '→', 'uarr': '↑', 'darr': '↓',
      'hearts': '♥', 'diams': '♦', 'clubs': '♣', 'spades': '♠',
      'check': '✓', 'cross': '✗', 'star': '★',
    };
    return entities[entity.toLowerCase()] || match;
  });

  // Clean up whitespace
  text = text
    .replace(/\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();

  return text;
}

/**
 * Parse a Gmail message into a clean readable object.
 * Handles both text/plain and text/html parts.
 */
function parseMessage(msg) {
  const headers = {};
  if (msg.payload?.headers) {
    for (const h of msg.payload.headers) {
      headers[h.name?.toLowerCase()] = h.value;
    }
  }

  // Extract body text from the message parts
  let plainText = '';
  let htmlText = '';
  let hasPlainText = false;
  let hasHtml = false;

  function extractParts(parts) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plainText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        hasPlainText = true;
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        hasHtml = true;
      }
      if (part.parts) extractParts(part.parts);
    }
  }

  // Check top-level body first
  if (msg.payload?.body?.data) {
    const mimeType = msg.payload.mimeType || '';
    const decoded = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
    if (mimeType === 'text/html') {
      htmlText = decoded;
      hasHtml = true;
    } else {
      plainText = decoded;
      hasPlainText = true;
    }
  }

  // Then check parts (multipart messages)
  if (msg.payload?.parts) {
    extractParts(msg.payload.parts);
  }

  // Determine final body: prefer plain text, fall back to HTML converted to text
  let body;
  if (hasPlainText && plainText.trim()) {
    body = plainText;
  } else if (hasHtml && htmlText.trim()) {
    body = htmlToText(htmlText);
  } else {
    body = '';
  }

  // Also keep the raw HTML for rich rendering in the UI
  // Truncate at 50KB to avoid sending massive emails
  const htmlBody = hasHtml && htmlText.trim() ? htmlText.substring(0, 50000) : null;

  const snippet = (msg.snippet || '').substring(0, 200);

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: headers['from'] || headers['sender'] || 'Unknown',
    to: headers['to'] || '',
    subject: headers['subject'] || '(No subject)',
    date: headers['date'] || '',
    snippet: snippet,
    body: body.substring(0, 10000) || snippet,
    htmlBody,
    labelIds: msg.labelIds || [],
  };
}

function createMimeMessage(to, subject, body) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ];
  const encoded = Buffer.from(lines.join('\r\n'), 'utf-8').toString('base64url');
  return encoded;
}

// ─── Email tools (formatted for AI) ─────────────────────────────────────────

async function listEmails(maxResults = 10) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: Math.min(maxResults, 50),
    q: 'in:inbox',
  });

  const messages = res.data.messages || [];
  if (messages.length === 0) return '📭 No emails found in inbox.';

  const details = await Promise.all(
    messages.map(async (m) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        return parseMessage(detail.data);
      } catch { return null; }
    })
  );

  const valid = details.filter(Boolean);
  if (valid.length === 0) return '📭 No emails found.';

  return valid.map((e, i) =>
    `${i + 1}. 📧 ${e.subject}\n   From: ${e.from}\n   Date: ${e.date}\n   ${e.snippet}\n`
  ).join('\n');
}

async function getEmail(id) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: id.trim(),
    format: 'full',
  });

  const email = parseMessage(res.data);

  return [
    `📧 **${email.subject}**`,
    `From: ${email.from}`,
    `To: ${email.to}`,
    `Date: ${email.date}`,
    `Labels: ${email.labelIds.join(', ')}`,
    ``,
    email.body,
  ].join('\n');
}

async function sendEmail(to, subject, body) {
  if (!to || typeof to !== 'string' || to.trim() === '') {
    throw new Error('Recipient (to) is required');
  }
  if (!subject || typeof subject !== 'string') subject = '';
  if (!body || typeof body !== 'string') body = '';

  const gmail = getGmailClient();
  const raw = createMimeMessage(to.trim(), subject, body);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return `✅ Email sent to ${to}` +
    (subject ? ` with subject "${subject}"` : '');
}

async function searchEmails(query, maxResults = 10) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new Error('Search query is required');
  }

  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: Math.min(maxResults, 50),
    q: query.trim(),
  });

  const messages = res.data.messages || [];
  if (messages.length === 0) return `🔍 No emails found matching "${query}".`;

  const details = await Promise.all(
    messages.map(async (m) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        return parseMessage(detail.data);
      } catch { return null; }
    })
  );

  const valid = details.filter(Boolean);
  if (valid.length === 0) return `🔍 No emails found matching "${query}".`;

  return valid.map((e, i) =>
    `${i + 1}. 📧 ${e.subject}\n   From: ${e.from}\n   Date: ${e.date}\n   ${e.snippet}\n`
  ).join('\n');
}

async function listLabels() {
  const gmail = getGmailClient();
  const res = await gmail.users.labels.list({ userId: 'me' });

  const labels = res.data.labels || [];
  if (labels.length === 0) return 'No labels found.';

  const systemLabels = labels.filter(l => l.type === 'system');
  const userLabels = labels.filter(l => l.type === 'user');

  let output = '📁 **Gmail Labels:**\n\n';

  if (systemLabels.length > 0) {
    output += '**System:**\n';
    output += systemLabels.map(l => `  🏷️ ${l.name}`).join('\n') + '\n\n';
  }

  if (userLabels.length > 0) {
    output += '**Your Labels:**\n';
    output += userLabels.map(l => `  📌 ${l.name}`).join('\n');
  }

  return output;
}

async function getProfile() {
  const gmail = getGmailClient();
  const res = await gmail.users.getProfile({ userId: 'me' });
  return {
    email: res.data.emailAddress || 'Unknown',
    totalMessages: res.data.messagesTotal || 0,
    totalThreads: res.data.threadsTotal || 0,
  };
}

// ─── Raw data endpoints (for the Gmail UI page) ─────────────────────────────

/**
 * Fetch inbox messages and return raw structured data with pagination support.
 * Returns { emails, nextPageToken } so the UI can paginate through ALL emails.
 */
async function listEmailsRaw(maxResults = 30, pageToken = null) {
  const gmail = getGmailClient();
  const params = {
    userId: 'me',
    maxResults: Math.min(maxResults, 100),
    q: 'in:inbox',
  };
  if (pageToken) params.pageToken = pageToken;

  const res = await gmail.users.messages.list(params);

  const messages = res.data.messages || [];
  const nextPageToken = res.data.nextPageToken || null;

  if (messages.length === 0) return { emails: [], nextPageToken: null };

  const details = await Promise.all(
    messages.map(async (m) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        return parseMessage(detail.data);
      } catch { return null; }
    })
  );

  return {
    emails: details.filter(Boolean),
    nextPageToken,
  };
}

/**
 * Get a single email's full content as raw structured data.
 */
async function getEmailRaw(id) {
  const gmail = getGmailClient();
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: id.trim(),
    format: 'full',
  });
  return parseMessage(res.data);
}

/**
 * Search emails and return raw structured data (for the Gmail UI).
 */
async function searchEmailsRaw(query, maxResults = 20) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return [];
  }

  const gmail = getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: Math.min(maxResults, 50),
    q: query.trim(),
  });

  const messages = res.data.messages || [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map(async (m) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        return parseMessage(detail.data);
      } catch { return null; }
    })
  );

  return details.filter(Boolean);
}

module.exports = {
  getAuthUrl,
  handleCallback,
  getStatus,
  getAuthState,
  disconnect,
  listEmails,
  getEmail,
  sendEmail,
  searchEmails,
  listLabels,
  getProfile,
  listEmailsRaw,
  getEmailRaw,
  searchEmailsRaw,
};
