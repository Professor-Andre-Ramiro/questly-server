const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const { filterQuestion } = require('./filter');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const QUESTIONS_PATH = path.join(DATA_DIR, 'questions.json');

const app = express();

// Allow the static pages on GitHub Pages to call this API.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://professor-andre-ramiro.github.io';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory teacher session tokens: token -> expiry timestamp (ms).
const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getConfig() {
  const config = readJSON(CONFIG_PATH);
  // The password lives in Render's environment settings, never in the code.
  config.teacherPassword = process.env.TEACHER_PASSWORD;
  return config;
}

if (!fs.existsSync(QUESTIONS_PATH)) writeJSON(QUESTIONS_PATH, []);

// Health check so the pages can wake the free Render instance.
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Reduces a question to a comparable form so that re-phrasings with different
// punctuation/casing/spacing are still recognized as "the same question".
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

function requireTeacher(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const expiry = token && sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  next();
}

// --- Public: site info (class name, so the student page can show it) ---
app.get('/api/info', (req, res) => {
  const config = getConfig();
  res.json({ className: config.className });
});

// --- Student: submit a question ---
app.post('/api/questions', (req, res) => {
  const config = getConfig();
  const result = filterQuestion(req.body && req.body.text, config);

  if (!result.ok) {
    return res.status(400).json({ accepted: false, reason: result.reason });
  }

  const questions = readJSON(QUESTIONS_PATH);
  const normalized = normalize(req.body.text);
  const existing = questions.find(q => q.normalized === normalized);
  const now = new Date().toISOString();

  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.lastAskedAt = now;
    existing.answered = false; // a fresh ask brings it back to the teacher's attention
  } else {
    questions.unshift({
      id: crypto.randomUUID(),
      text: req.body.text.trim(),
      normalized,
      count: 1,
      createdAt: now,
      lastAskedAt: now,
      answered: false
    });
  }
  writeJSON(QUESTIONS_PATH, questions);

  res.json({ accepted: true });
});

// --- Teacher: login ---
app.post('/api/teacher/login', (req, res) => {
  const config = getConfig();
  const { password } = req.body || {};

  // No TEACHER_PASSWORD set = test mode: the dashboard opens without a password.
  if (config.teacherPassword && password !== config.teacherPassword) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  res.json({ token });
});

// --- Teacher: list questions, most-asked first ---
app.get('/api/teacher/questions', requireTeacher, (req, res) => {
  const questions = readJSON(QUESTIONS_PATH);
  questions.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastAskedAt) - new Date(a.lastAskedAt);
  });
  res.json({ questions });
});

// --- Teacher: mark a question answered/unanswered ---
app.patch('/api/teacher/questions/:id', requireTeacher, (req, res) => {
  const questions = readJSON(QUESTIONS_PATH);
  const question = questions.find(q => q.id === req.params.id);
  if (!question) return res.status(404).json({ error: 'Question not found.' });

  if (typeof req.body.answered === 'boolean') {
    question.answered = req.body.answered;
  }
  writeJSON(QUESTIONS_PATH, questions);
  res.json({ question });
});

// --- Teacher: delete a question ---
app.delete('/api/teacher/questions/:id', requireTeacher, (req, res) => {
  const questions = readJSON(QUESTIONS_PATH);
  const next = questions.filter(q => q.id !== req.params.id);
  writeJSON(QUESTIONS_PATH, next);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Anonymous questions site running at http://localhost:${PORT}`);
  console.log(`Student page: http://localhost:${PORT}/`);
  console.log(`Teacher dashboard: http://localhost:${PORT}/teacher.html`);
});
