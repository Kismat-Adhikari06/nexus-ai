const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, generateId } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'nexu-dev-secret-change-in-production';
const SALT_ROUNDS = 10;

function register(username, password) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
  if (existing) {
    throw new Error('Username already taken');
  }
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const id = generateId();
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(id, username.toLowerCase(), hash);
  const token = jwt.sign({ userId: id, username: username.toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
  return { token, user: { id, username: username.toLowerCase() } };
}

function login(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username.toLowerCase());
  if (!user) {
    throw new Error('Invalid username or password');
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    throw new Error('Invalid username or password');
  }
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  return { token, user: { id: user.id, username: user.username } };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { register, login, authenticateToken };
