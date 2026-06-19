const { OAuth2Client } = require('google-auth-library');
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

/**
 * Generate the Google OAuth URL for the user to visit.
 * Stores the clientId/clientSecret in memory so the callback handler
 * can use them later (since the callback is a redirect from Google).
 */
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
    prompt: 'consent', // Forces refresh token on every auth
  });

  return url;
}

/**
 * Handle the OAuth callback from Google.
 * Exchanges the authorization code for tokens and stores them.
 */
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

    // Persist tokens + client info for server restart recovery
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

/**
 * Restore the connection from saved tokens on server startup.
 */
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

/**
 * Get the current connection status.
 */
function getStatus() {
  if (_connected) return '✅ Connected to Gmail';
  if (_authInProgress) return '⏳ Waiting for you to authorize in the browser...';
  return '❌ Not connected to Gmail';
}

/**
 * Get full connection state (for the QR-data style endpoint).
 */
function getAuthState() {
  return {
    connected: _connected,
    authInProgress: _authInProgress,
  };
}

/**
 * Disconnect and clear all saved tokens.
 */
async function disconnect() {
  // Revoke the token if we have one
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

// Attempt to restore connection from saved tokens on module load
restoreFromSavedTokens();

module.exports = {
  getAuthUrl,
  handleCallback,
  getStatus,
  getAuthState,
  disconnect,
};
