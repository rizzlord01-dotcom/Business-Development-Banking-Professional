require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CERT_DIR = path.join(UPLOADS_DIR, 'certificates');
const PHOTO_DIR = path.join(UPLOADS_DIR, 'photo');
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Auth ----------

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  res.json({ token: signToken(user), username: user.username });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.sub);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

// ---------- Content ----------

function getContent() {
  const row = db.prepare('SELECT json FROM site_content WHERE id = 1').get();
  return JSON.parse(row.json);
}

function getCertificates() {
  return db.prepare('SELECT id, title, issuer, filename, original_name, created_at FROM certificates ORDER BY sort_order ASC, id ASC').all();
}

app.get('/api/content', (req, res) => {
  res.json({ content: getContent(), certificates: getCertificates() });
});

app.put('/api/content', requireAuth, (req, res) => {
  const incoming = req.body || {};
  const allowedKeys = ['sidebar', 'photo', 'hero', 'experience', 'competencies', 'education', 'contact'];
  const current = getContent();
  for (const key of allowedKeys) {
    if (key in incoming) current[key] = incoming[key];
  }
  db.prepare('UPDATE site_content SET json = ? WHERE id = 1').run(JSON.stringify(current));
  res.json({ content: current });
});

// ---------- Certificate uploads ----------

fs.mkdirSync(CERT_DIR, { recursive: true });
fs.mkdirSync(PHOTO_DIR, { recursive: true });

const certStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CERT_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}.pdf`);
  }
});
const uploadCert = multer({
  storage: certStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are allowed.'));
    cb(null, true);
  }
});

app.post('/api/certificates', requireAuth, uploadCert.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const { title, issuer } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM certificates').get().m;
  const info = db.prepare(
    'INSERT INTO certificates (title, issuer, filename, original_name, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(title, issuer || '', req.file.filename, req.file.originalname, maxOrder + 1);

  res.json({ certificate: db.prepare('SELECT * FROM certificates WHERE id = ?').get(info.lastInsertRowid) });
});

app.delete('/api/certificates/:id', requireAuth, (req, res) => {
  const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(req.params.id);
  if (!cert) return res.status(404).json({ error: 'Not found.' });
  const filePath = path.join(CERT_DIR, cert.filename);
  fs.existsSync(filePath) && fs.unlinkSync(filePath);
  db.prepare('DELETE FROM certificates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Photo upload ----------

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTO_DIR),
  filename: (req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '.jpg';
    cb(null, `portrait-${Date.now()}${ext}`);
  }
});
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
    }
    cb(null, true);
  }
});

app.post('/api/photo', requireAuth, uploadPhoto.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const current = getContent();

  if (current.photo) {
    const oldPath = path.join(PHOTO_DIR, path.basename(current.photo));
    fs.existsSync(oldPath) && fs.unlinkSync(oldPath);
  }
  current.photo = `/uploads/photo/${req.file.filename}`;
  db.prepare('UPDATE site_content SET json = ? WHERE id = 1').run(JSON.stringify(current));
  res.json({ content: current });
});

app.delete('/api/photo', requireAuth, (req, res) => {
  const current = getContent();
  if (current.photo) {
    const oldPath = path.join(PHOTO_DIR, path.basename(current.photo));
    fs.existsSync(oldPath) && fs.unlinkSync(oldPath);
  }
  current.photo = null;
  db.prepare('UPDATE site_content SET json = ? WHERE id = 1').run(JSON.stringify(current));
  res.json({ content: current });
});

// ---------- Error handler (multer errors etc.) ----------

app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message || 'Something went wrong.' });
  next();
});

app.listen(PORT, () => {
  console.log(`LBA portfolio server running on http://localhost:${PORT}`);
});
