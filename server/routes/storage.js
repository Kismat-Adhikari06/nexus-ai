const express = require('express');
const { getDb, generateId } = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Facts ───────────────────────────────────────────────────────────────────

router.get('/facts', (req, res) => {
  const db = getDb();
  const facts = db.prepare('SELECT * FROM facts WHERE user_id = ?').all(req.user.userId);
  const result = {};
  for (const f of facts) {
    result[f.key] = {
      value: f.value,
      category: f.category,
      confidence: f.confidence,
      source: f.source,
      timestamp: f.timestamp,
      status: f.status,
    };
  }
  res.json({ result });
});

router.post('/facts/save', (req, res) => {
  const { key, value, category, confidence, source, status } = req.body;
  if (!key || !value) return res.status(400).json({ error: 'key and value required' });
  const db = getDb();
  const existing = db.prepare('SELECT id FROM facts WHERE user_id = ? AND key = ?').get(req.user.userId, key.toLowerCase());
  if (existing) {
    db.prepare(`UPDATE facts SET value = ?, category = ?, confidence = ?, source = ?, status = ?, timestamp = datetime('now') WHERE id = ?`)
      .run(value, category || 'other', confidence ?? 100, source || 'direct_statement', status || 'saved', existing.id);
  } else {
    db.prepare('INSERT INTO facts (id, user_id, key, value, category, confidence, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(generateId(), req.user.userId, key.toLowerCase(), value, category || 'other', confidence ?? 100, source || 'direct_statement', status || 'saved');
  }
  res.json({ result: `Remembered: ${key} = ${value}` });
});

router.delete('/facts/:key', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM facts WHERE user_id = ? AND key = ?').run(req.user.userId, req.params.key.toLowerCase());
  res.json({ result: `Forgot '${req.params.key}'` });
});

router.delete('/facts', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM facts WHERE user_id = ?').run(req.user.userId);
  res.json({ result: 'All facts cleared' });
});

router.patch('/facts/:key', (req, res) => {
  const db = getDb();
  const { value, category, confidence, source, status } = req.body;
  const updates = [];
  const params = [];
  if (value !== undefined) { updates.push('value = ?'); params.push(value); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (confidence !== undefined) { updates.push('confidence = ?'); params.push(confidence); }
  if (source !== undefined) { updates.push('source = ?'); params.push(source); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (updates.length === 0) return res.json({ result: 'No updates' });
  updates.push("timestamp = datetime('now')");
  params.push(req.user.userId, req.params.key.toLowerCase());
  db.prepare(`UPDATE facts SET ${updates.join(', ')} WHERE user_id = ? AND key = ?`).run(...params);
  res.json({ result: 'Fact updated' });
});

// ─── History ─────────────────────────────────────────────────────────────────

router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const db = getDb();
  const history = db.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?').all(req.user.userId, limit);
  res.json({ result: history.reverse() });
});

router.post('/history', (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) return res.status(400).json({ error: 'role and content required' });
  const db = getDb();
  db.prepare('INSERT INTO history (id, user_id, role, content) VALUES (?, ?, ?, ?)')
    .run(generateId(), req.user.userId, role, content);
  res.json({ result: 'Saved' });
});

router.delete('/history/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM history WHERE user_id = ? AND id = ?').run(req.user.userId, req.params.id);
  res.json({ result: 'Deleted' });
});

router.delete('/history', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM history WHERE user_id = ?').run(req.user.userId);
  res.json({ result: 'All history cleared' });
});

router.get('/history/search', (req, res) => {
  const query = req.query.q || '';
  const limit = parseInt(req.query.limit) || 3;
  const db = getDb();
  const results = db.prepare(
    'SELECT * FROM history WHERE user_id = ? AND content LIKE ? ORDER BY timestamp DESC LIMIT ?'
  ).all(req.user.userId, `%${query}%`, limit);
  res.json({ result: results.reverse() });
});

// ─── Conversations ───────────────────────────────────────────────────────────

router.get('/conversations', (req, res) => {
  const db = getDb();
  const convs = db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.userId);
  res.json({ result: convs.map(c => ({ ...c, messages: JSON.parse(c.messages) })) });
});

router.post('/conversations', (req, res) => {
  const { id, title, messages } = req.body;
  const convId = id || generateId();
  const db = getDb();
  db.prepare('INSERT INTO conversations (id, user_id, title, messages) VALUES (?, ?, ?, ?)')
    .run(convId, req.user.userId, title || 'New conversation', JSON.stringify(messages || []));
  res.json({ result: { id: convId, title: title || 'New conversation' } });
});

router.put('/conversations/:id', (req, res) => {
  const { title, messages } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM conversations WHERE user_id = ? AND id = ?').get(req.user.userId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Conversation not found' });
  const updates = [];
  const params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (messages !== undefined) { updates.push('messages = ?'); params.push(JSON.stringify(messages)); }
  if (updates.length === 0) return res.json({ result: 'No updates' });
  updates.push("updated_at = datetime('now')");
  params.push(req.user.userId, req.params.id);
  db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`).run(...params);
  res.json({ result: 'Updated' });
});

router.delete('/conversations/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE user_id = ? AND id = ?').run(req.user.userId, req.params.id);
  res.json({ result: 'Deleted' });
});

router.delete('/conversations', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE user_id = ?').run(req.user.userId);
  res.json({ result: 'All conversations cleared' });
});

module.exports = router;
