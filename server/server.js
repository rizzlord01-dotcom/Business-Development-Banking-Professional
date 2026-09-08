require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT_NAME);
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? null : 'dev-only-secret-change-me');

if (isProduction && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production.');
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || (isProduction ? false : true) }));
app.use(express.json({ limit: '2mb' }));

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const CERT_DIR = path.join(UPLOADS_DIR, 'certificates');
const PHOTO_DIR = path.join(UPLOADS_DIR, 'photo');
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'lba-portfolio' });
});

// ---------- Auth ----------

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

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

app.post('/api/login', loginLimiter, (req, res) => {
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
    if (key in incoming && JSON.stringify(incoming[key]).length > 100000) {
      return res.status(400).json({ error: 'That section is too large.' });
    }
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

function hasPdfSignature(filePath) {
  return fs.readFileSync(filePath).subarray(0, 4).toString('ascii') === '%PDF';
}

function hasImageSignature(filePath, mimetype) {
  const header = fs.readFileSync(filePath).subarray(0, 12);
  if (mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mimetype === 'image/png') return header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimetype === 'image/webp') return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

app.post('/api/certificates', requireAuth, uploadCert.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const { title, issuer } = req.body || {};
  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Title is required.' });
  }
  if (!hasPdfSignature(req.file.path)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'The uploaded file is not a valid PDF.' });
  }

  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM certificates').get().m;
  let info;
  try {
    info = db.prepare(
      'INSERT INTO certificates (title, issuer, filename, original_name, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(title, issuer || '', req.file.filename, req.file.originalname, maxOrder + 1);
  } catch (error) {
    fs.unlinkSync(req.file.path);
    throw error;
  }

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
  if (!hasImageSignature(req.file.path, req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'The uploaded file is not a valid image.' });
  }
  const current = getContent();

  const oldPath = current.photo ? path.join(PHOTO_DIR, path.basename(current.photo)) : null;
  current.photo = `/uploads/photo/${req.file.filename}`;
  try {
    db.prepare('UPDATE site_content SET json = ? WHERE id = 1').run(JSON.stringify(current));
  } catch (error) {
    fs.unlinkSync(req.file.path);
    throw error;
  }
  if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
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
