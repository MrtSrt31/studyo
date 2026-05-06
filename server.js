'use strict';
const fs   = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

// .env oku — yoksa oluştur
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, '');
require('dotenv').config({ path: envPath });

const crypto  = require('crypto');
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const helmet   = require('helmet');
const { rateLimit } = require('express-rate-limit');
const cookieParser  = require('cookie-parser');
const multer = require('multer');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT    = parseInt(process.env.PORT) || 3000;
const APP_BASE_PATH = normalizeBasePath(process.env.APP_BASE_PATH || '/studyo');
const COOKIE_PATH = APP_BASE_PATH === '/' ? '/' : APP_BASE_PATH;
const INDEX_FILE_PATH = path.join(__dirname, 'app.html');
const LANDING_FILE_PATH = path.join(__dirname, 'home.html');
const BCRYPT_ROUNDS  = 12;
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = '$2b$12$s3Cjaku00dtgrYmiVenJGe/Y6kPNhT4BBfoHahlBIrfKjK02tyPem';

// PBKDF2-SHA512 password hashing (new format, replaces bcrypt for new users)
const PBKDF2_ITERATIONS = 200000;
const PBKDF2_KEYLEN = 48; // 48 of 64 bytes — partial key in DB
const PBKDF2_ALGO = 'sha512';
const PBKDF2_VERSION = 'p1';
const VALID_PALETTES = ['warm', 'ocean', 'forest', 'slate', 'rose'];
const MAX_PORT_ATTEMPTS = 20;
const MAX_UPLOAD_BYTES = 256 * 1024 * 1024; // 256 MB
const STATE_PAYLOAD_LIMIT = '2mb';
const APP_STORAGE_DIR = path.join(__dirname, 'storage');
const DATA_FILE_PATH = process.env.DATA_FILE_PATH || path.join(APP_STORAGE_DIR, 'app-data.json');
const UPLOAD_TEMP_DIR = path.join(APP_STORAGE_DIR, 'tmp');
const UPLOAD_DATA_DIR = path.join(APP_STORAGE_DIR, 'uploads');
const fsPromises = fs.promises;

function normalizeBasePath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function withBasePath(route = '/') {
  const normalizedRoute = !route || route === '/' ? '/' : (route.startsWith('/') ? route : `/${route}`);
  if (APP_BASE_PATH === '/') return normalizedRoute;
  return normalizedRoute === '/' ? APP_BASE_PATH : `${APP_BASE_PATH}${normalizedRoute}`;
}

function upsertEnvVar(key, value) {
  const safeValue = String(value).replace(/\r?\n/g, '');
  const line = `${key}=${safeValue}`;
  const content = fs.readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const next = regex.test(content)
    ? content.replace(regex, line)
    : `${line}\n${content.trimStart()}`;
  fs.writeFileSync(envPath, `${next.trimStart()}\n`);
}

// ── PBKDF2-SHA512 şifreleme (yeni format) ────────────────────────────────────
// APP_DATA_KEY'in ilk 32 baytını pepper (ek gizlilik katmanı) olarak kullanır.
// Saklanan hash: sadece ilk 48 bayt (64 baytın bir kısmı) — "key'in bir kısmı DB'de"
function getPepper() { return APP_DATA_KEY.slice(0, 32); }
function pepperPassword(password) {
  return crypto.createHmac('sha512', getPepper()).update(String(password)).digest();
}
function isBcryptHash(hash) { return typeof hash === 'string' && hash.startsWith('$2'); }

function hashPasswordNew(password) {
  const salt = crypto.randomBytes(32).toString('base64url');
  const peppered = pepperPassword(password);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(peppered, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_ALGO, (err, key) => {
      if (err) return reject(err);
      resolve(`${PBKDF2_VERSION}:${PBKDF2_ITERATIONS}:${salt}:${key.toString('base64url')}`);
    });
  });
}

function verifyPasswordNew(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 4 || parts[0] !== PBKDF2_VERSION) return Promise.resolve(false);
  const [, itersStr, salt, storedHash] = parts;
  const iters = parseInt(itersStr, 10);
  if (!Number.isFinite(iters) || iters < 1) return Promise.resolve(false);
  const peppered = pepperPassword(password);
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(peppered, salt, iters, PBKDF2_KEYLEN, PBKDF2_ALGO, (err, key) => {
      if (err) return reject(err);
      try {
        const derived = Buffer.from(key.toString('base64url'));
        const expected = Buffer.from(storedHash);
        if (derived.length !== expected.length) return resolve(false);
        resolve(crypto.timingSafeEqual(derived, expected));
      } catch { resolve(false); }
    });
  });
}

// Timing-attack koruması: kullanıcı bulunamadığında da PBKDF2 hesapla
let _dummyHashPromise = null;
function getDummyHash() {
  if (!_dummyHashPromise) _dummyHashPromise = hashPasswordNew('__timing_dummy__');
  return _dummyHashPromise;
}

// ── JWT_SECRET ────────────────────────────────────────────────────────────────
// JWT_SECRET: .env'de yoksa veya placeholder ise otomatik üret ve kaydet
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.startsWith('buraya')) {
  JWT_SECRET = crypto.randomBytes(64).toString('hex');
  upsertEnvVar('JWT_SECRET', JWT_SECRET);
  console.log('✓  JWT_SECRET otomatik oluşturuldu ve .env dosyasına kaydedildi.');
}

let APP_DATA_KEY;
try {
  APP_DATA_KEY = process.env.APP_DATA_KEY ? Buffer.from(process.env.APP_DATA_KEY, 'base64') : null;
} catch {
  APP_DATA_KEY = null;
}
if (!APP_DATA_KEY || APP_DATA_KEY.length !== 32) {
  const generated = crypto.randomBytes(32).toString('base64');
  upsertEnvVar('APP_DATA_KEY', generated);
  APP_DATA_KEY = Buffer.from(generated, 'base64');
  console.log('✓  APP_DATA_KEY otomatik oluşturuldu ve .env dosyasına kaydedildi.');
}

fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DATA_DIR, { recursive: true });

// ── Dosya tabanlı veri deposu ────────────────────────────────────────────────
function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function defaultDataStore() {
  return {
    nextIds: { users: 1, files: 1 },
    users: [],
    userAppState: [],
    userFiles: [],
  };
}

function normalizeDataStore(raw) {
  const base = defaultDataStore();
  const nextIds = raw?.nextIds && typeof raw.nextIds === 'object' ? raw.nextIds : {};
  return {
    nextIds: {
      users: Math.max(1, Math.round(Number(nextIds.users) || 1)),
      files: Math.max(1, Math.round(Number(nextIds.files) || 1)),
    },
    users: Array.isArray(raw?.users) ? raw.users : base.users,
    userAppState: Array.isArray(raw?.userAppState) ? raw.userAppState : base.userAppState,
    userFiles: Array.isArray(raw?.userFiles) ? raw.userFiles : base.userFiles,
  };
}

function loadDataStore() {
  if (!fs.existsSync(DATA_FILE_PATH)) return defaultDataStore();
  try {
    return normalizeDataStore(JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8')));
  } catch {
    return defaultDataStore();
  }
}

function saveDataStore() {
  const tempPath = `${DATA_FILE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(dataStore, null, 2));
  fs.renameSync(tempPath, DATA_FILE_PATH);
}

function cloneRow(row) {
  return row ? { ...row } : undefined;
}

function publicUserRow(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    dept: row.dept,
    goal_hours: row.goal_hours,
    theme: row.theme,
    lang: row.lang,
    active: row.active,
    created_at: row.created_at,
  };
}

function decodeStateRow(row) {
  if (!row) return undefined;
  return {
    payload_enc: Buffer.from(row.payload_enc, 'base64'),
    iv: Buffer.from(row.iv, 'base64'),
    auth_tag: Buffer.from(row.auth_tag, 'base64'),
  };
}

function decodeFileRow(row) {
  if (!row) return undefined;
  return {
    ...row,
    iv: Buffer.from(row.iv, 'base64'),
    auth_tag: Buffer.from(row.auth_tag, 'base64'),
  };
}

let dataStore = loadDataStore();

const q = {
  count: {
    get() {
      return { c: dataStore.users.length };
    },
  },
  byEmail: {
    get(email) {
      const normalizedEmail = String(email || '').toLowerCase();
      return cloneRow(dataStore.users.find((user) => user.email.toLowerCase() === normalizedEmail));
    },
  },
  byId: {
    get(id) {
      return publicUserRow(dataStore.users.find((user) => user.id === Number(id)));
    },
  },
  insert: {
    run(name, email, passwordHash, dept, goalHours, theme, lang, role) {
      const id = dataStore.nextIds.users++;
      dataStore.users.push({
        id,
        name,
        email,
        dept,
        password_hash: passwordHash,
        role,
        goal_hours: goalHours,
        theme,
        lang,
        active: 1,
        created_at: nowSql(),
      });
      saveDataStore();
      return { lastInsertRowid: id };
    },
  },
  allUsers: {
    all() {
      return dataStore.users
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          dept: user.dept,
          active: user.active,
          created_at: user.created_at,
        }));
    },
  },
  setRole: {
    run(role, id) {
      const user = dataStore.users.find((entry) => entry.id === Number(id));
      if (!user) return { changes: 0 };
      user.role = role;
      saveDataStore();
      return { changes: 1 };
    },
  },
  setActive: {
    run(active, id) {
      const user = dataStore.users.find((entry) => entry.id === Number(id));
      if (!user) return { changes: 0 };
      user.active = active;
      saveDataStore();
      return { changes: 1 };
    },
  },
  delete: {
    run(id) {
      const numericId = Number(id);
      const before = dataStore.users.length;
      dataStore.users = dataStore.users.filter((user) => user.id !== numericId);
      if (dataStore.users.length === before) return { changes: 0 };
      dataStore.userAppState = dataStore.userAppState.filter((state) => state.user_id !== numericId);
      dataStore.userFiles = dataStore.userFiles.filter((file) => file.user_id !== numericId);
      saveDataStore();
      return { changes: 1 };
    },
  },
  stateByUser: {
    get(userId) {
      return decodeStateRow(dataStore.userAppState.find((state) => state.user_id === Number(userId)));
    },
  },
  upsertState: {
    run(userId, payloadEnc, iv, authTag) {
      const numericUserId = Number(userId);
      const nextRow = {
        user_id: numericUserId,
        payload_enc: Buffer.from(payloadEnc).toString('base64'),
        iv: Buffer.from(iv).toString('base64'),
        auth_tag: Buffer.from(authTag).toString('base64'),
        updated_at: nowSql(),
      };
      const index = dataStore.userAppState.findIndex((state) => state.user_id === numericUserId);
      if (index === -1) dataStore.userAppState.push(nextRow);
      else dataStore.userAppState[index] = nextRow;
      saveDataStore();
      return { changes: 1 };
    },
  },
  filesByUser: {
    all(userId) {
      return dataStore.userFiles
        .filter((file) => file.user_id === Number(userId))
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((file) => cloneRow(file));
    },
  },
  fileById: {
    get(id, userId) {
      return decodeFileRow(
        dataStore.userFiles.find((file) => file.id === Number(id) && file.user_id === Number(userId)),
      );
    },
  },
  insertFile: {
    run(userId, originalName, storedName, mimeType, sizeBytes, iv, authTag) {
      const id = dataStore.nextIds.files++;
      dataStore.userFiles.push({
        id,
        user_id: Number(userId),
        original_name: originalName,
        stored_name: storedName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        iv: Buffer.from(iv).toString('base64'),
        auth_tag: Buffer.from(authTag).toString('base64'),
        created_at: nowSql(),
      });
      saveDataStore();
      return { lastInsertRowid: id };
    },
  },
  deleteFile: {
    run(id, userId) {
      const before = dataStore.userFiles.length;
      dataStore.userFiles = dataStore.userFiles.filter(
        (file) => !(file.id === Number(id) && file.user_id === Number(userId)),
      );
      if (dataStore.userFiles.length === before) return { changes: 0 };
      saveDataStore();
      return { changes: 1 };
    },
  },
  updatePasswordHash: {
    run(id, newHash) {
      const user = dataStore.users.find((u) => u.id === Number(id));
      if (!user) return { changes: 0 };
      user.password_hash = newHash;
      saveDataStore();
      return { changes: 1 };
    },
  },
};

// ── Express ────────────────────────────────────────────────────────────────────
const app = express();
const appRouter = express.Router();
app.set('trust proxy', 1);

const IS_PROD = process.env.NODE_ENV === 'production';

// Güvenlik başlıkları (XSS, clickjacking, MIME sniffing vb.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:              ["'self'"],
      // Babel standalone + CDN React requires unsafe-inline/unsafe-eval; scoped to unpkg only
      scriptSrc:               ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://unpkg.com'],
      styleSrc:                ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:                 ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:                  ["'self'", 'data:', 'https:'],
      // Spotify OAuth redirect is a navigation (window.location), not a fetch,
      // so connectSrc stays 'self' — token exchange now proxied via /api/spotify/*
      connectSrc:              ["'self'"],
      upgradeInsecureRequests: IS_PROD ? [] : null,
    },
  },
  // HSTS: force HTTPS for 1 year in production
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

app.use(express.json({ limit: STATE_PAYLOAD_LIMIT }));
app.use(cookieParser());

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Login: 10 başarısız deneme / 15 dk (başarılı girişler sayılmaz)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});

// Kayıt: 5 hesap / saat
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Çok fazla kayıt denemesi. Bir saat sonra tekrar deneyin.' },
});

// Kurulum: 5 deneme / saat — internete açık ilk kurulumu kilitler
const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Çok fazla kurulum denemesi.' },
});

// ── Auth yardımcıları ─────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

function setCookie(res, token) {
  res.cookie('studyo_token', token, {
    httpOnly: true,                                   // JS erişemez (XSS koruması)
    secure: process.env.NODE_ENV === 'production',   // HTTPS zorunluluğu (prod)
    sameSite: 'strict',                              // CSRF koruması
    maxAge: COOKIE_MAX_AGE,
    path: COOKIE_PATH,
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies.studyo_token;
  if (!token) return res.status(401).json({ error: 'Oturum açılmamış' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.clearCookie('studyo_token', { path: COOKIE_PATH });
    return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yapın' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    next();
  });
}

function validateEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

// CSRF: tüm durum değiştiren (non-safe) API isteklerinde özel başlık zorunlu.
// Tarayıcı cross-site form/image isteklerine özel başlık ekleyemez → CSRF'e karşı defense-in-depth.
function requireCsrf(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers['x-requested-with'] !== 'studyo-app')
      return res.status(403).json({ error: 'CSRF doğrulama başarısız' });
  }
  next();
}

// Tüm /studyo/* mutating istekleri için CSRF zorunlu (login/register dahil — apiFetch zaten başlık ekliyor)
appRouter.use(requireCsrf);

function openBrowser(url) {
  const { exec } = require('child_process');
  const cmd = process.platform === 'darwin' ? `open "${url}"`
            : process.platform === 'win32'  ? `start "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd);
}

// Kullanıcı satırını güvenli nesneye dönüştür (password_hash asla dışarı çıkmaz)
function safeUser(row) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return { ...safe, goalHours: safe.goal_hours };
}

// Allow-list: yalnızca güvenli dosya uzantılarına izin ver (block-list yerine)
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  // Belgeler
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.rtf', '.txt', '.md', '.csv',
  // Görseller
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.heic', '.avif',
  // Videolar
  '.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v',
  // Sesler
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  // Arşivler
  '.zip', '.tar', '.gz', '.7z', '.rar',
  // Veri
  '.json', '.yaml', '.yml', '.toml',
]);

function sanitizeText(value, maxLen = 5000) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLen);
}

function sanitizeFilename(name) {
  const cleaned = sanitizeText(path.basename(String(name || '')), 180)
    .replace(/[\\/:"*?<>|]+/g, '_')
    .replace(/\s+/g, ' ');
  return cleaned.replace(/^\.+/, '');
}

function normalizeIntArray(arr, length, min, max) {
  if (!Array.isArray(arr)) return Array.from({ length }, () => 0);
  const out = arr.slice(0, length).map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(min, Math.min(max, Math.round(n)));
  });
  while (out.length < length) out.push(0);
  return out;
}

function normalizeTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.slice(0, 500).map((task, i) => ({
    id: Number.isFinite(Number(task?.id)) ? Number(task.id) : Date.now() + i,
    title: sanitizeText(task?.title, 180),
    done: !!task?.done,
    course: sanitizeText(task?.course, 60),
    est: Math.max(1, Math.min(720, Math.round(Number(task?.est) || 30))),
    priority: ['low', 'med', 'high'].includes(task?.priority) ? task.priority : 'med',
  })).filter((task) => task.title);
}

function normalizeClasses(classes) {
  if (!Array.isArray(classes)) return [];
  return classes.slice(0, 120).map((c, i) => ({
    id: Number.isFinite(Number(c?.id)) ? Number(c.id) : Date.now() + i,
    course: sanitizeText(c?.course, 30),
    title: sanitizeText(c?.title, 120),
    room: sanitizeText(c?.room, 40),
    date: /^\d{4}-\d{2}-\d{2}$/.test(c?.date) ? c.date : '',
    start: /^\d{2}:\d{2}$/.test(c?.start) ? c.start : '09:00',
    end: /^\d{2}:\d{2}$/.test(c?.end) ? c.end : '10:00',
    color: ['amber', 'info', 'success', 'warning', 'danger'].includes(c?.color) ? c.color : 'amber',
  })).filter((c) => c.title);
}

function sanitizeHexColor(value, fallback = '#007AFF') {
  if (typeof value !== 'string') return fallback;
  const color = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
}

function defaultAppState(goalHours = 4) {
  return {
    tasks: [],
    notes: '',
    classes: [],
    week: [0, 0, 0, 0, 0, 0, 0],
    heatmap: Array.from({ length: 91 }, () => 0),
    days7: [0, 0, 0, 0, 0, 0, 0],
    todayFocus: 0,
    timer: { focusMin: 25, restMin: 5, countMin: 30 },
    appearance: { accentColor: '#007AFF', palette: 'warm', spotifyClientId: '', theme: 'light', lang: 'tr' },
    longestSession: 0,
    goalHours: Math.max(1, Math.min(12, Math.round(Number(goalHours) || 4))),
  };
}

function sanitizeAppState(payload, goalHours = 4) {
  const d = defaultAppState(goalHours);
  if (!payload || typeof payload !== 'object') return d;
  const timer = payload.timer && typeof payload.timer === 'object' ? payload.timer : {};
  const app = payload.appearance && typeof payload.appearance === 'object' ? payload.appearance : {};
  const safeStr = (v, max, fb = '') => (typeof v === 'string' ? v.slice(0, max).trim() : fb);
  return {
    tasks: normalizeTasks(payload.tasks),
    notes: sanitizeText(payload.notes, 20000),
    classes: normalizeClasses(payload.classes),
    week: normalizeIntArray(payload.week, 7, 0, 24 * 60),
    heatmap: normalizeIntArray(payload.heatmap, 91, 0, 4),
    days7: normalizeIntArray(payload.days7, 7, 0, 4),
    todayFocus: Math.max(0, Math.min(24 * 60, Math.round(Number(payload.todayFocus) || 0))),
    timer: {
      focusMin: Math.max(5, Math.min(90, Math.round(Number(timer.focusMin) || d.timer.focusMin))),
      restMin: Math.max(1, Math.min(30, Math.round(Number(timer.restMin) || d.timer.restMin))),
      countMin: Math.max(1, Math.min(180, Math.round(Number(timer.countMin) || d.timer.countMin))),
    },
    appearance: {
      accentColor: sanitizeHexColor(app.accentColor, d.appearance.accentColor),
      palette: VALID_PALETTES.includes(app.palette) ? app.palette : d.appearance.palette,
      spotifyClientId: safeStr(app.spotifyClientId, 80),
      theme: ['light', 'dark'].includes(app.theme) ? app.theme : d.appearance.theme,
      lang: ['tr', 'en'].includes(app.lang) ? app.lang : d.appearance.lang,
    },
    longestSession: Math.max(0, Math.round(Number(payload.longestSession) || 0)),
    goalHours: d.goalHours,
  };
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', APP_DATA_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { encrypted, iv, authTag: cipher.getAuthTag() };
}

function decryptBuffer(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', APP_DATA_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function encryptJson(value) {
  return encryptBuffer(Buffer.from(JSON.stringify(value), 'utf8'));
}

function decryptJson(row) {
  const decrypted = decryptBuffer(row.payload_enc, row.iv, row.auth_tag);
  return JSON.parse(decrypted.toString('utf8'));
}

function userUploadDir(userId) {
  return path.join(UPLOAD_DATA_DIR, String(userId));
}

function encryptedFilePath(userId, storedName) {
  return path.join(userUploadDir(userId), storedName);
}

async function encryptFileAtRest(sourcePath, targetPath) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', APP_DATA_KEY, iv);
  await pipeline(
    fs.createReadStream(sourcePath),
    cipher,
    fs.createWriteStream(targetPath, { mode: 0o600 }),
  );
  return { iv, authTag: cipher.getAuthTag() };
}

async function streamDecryptedFile(sourcePath, iv, authTag, destination) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', APP_DATA_KEY, iv);
  decipher.setAuthTag(authTag);
  await pipeline(fs.createReadStream(sourcePath), decipher, destination);
}

function safeUploadMeta(row) {
  return {
    id: row.id,
    name: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_TEMP_DIR),
    filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID().replace(/-/g, '')}.tmp`),
  }),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 4,
    parts: 6,
    fieldNameSize: 120,
  },
  fileFilter: (_req, file, cb) => {
    const safeName = sanitizeFilename(file.originalname);
    if (!safeName) {
      const err = new Error('Geçersiz dosya adı');
      err.code = 'INVALID_UPLOAD_NAME';
      return cb(err);
    }
    const ext = path.extname(safeName).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      const err = new Error('Bu dosya türüne izin verilmiyor');
      err.code = 'UNSAFE_FILE_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
});

function runSingleUpload(req, res, next) {
  upload.single('file')(req, res, next);
}

// ── API Rotaları ──────────────────────────────────────────────────────────────

// İlk kurulum gerekli mi?
app.get('/', (_req, res) => res.sendFile(LANDING_FILE_PATH));
app.use(APP_BASE_PATH, appRouter);

appRouter.get('/api/setup-status', (_req, res) => {
  res.json({ needsSetup: q.count.get().c === 0 });
});

// İlk admin kurulumu (sadece hiç kullanıcı yokken çalışır)
appRouter.post('/api/setup', setupLimiter, asyncRoute(async (req, res) => {
  if (q.count.get().c > 0) return res.status(403).json({ error: 'Kurulum zaten tamamlandı' });

  // Opsiyonel bootstrap secret — .env'e SETUP_SECRET eklenirse zorunlu hale gelir
  const setupSecret = process.env.SETUP_SECRET;
  if (setupSecret && req.body.setupSecret !== setupSecret)
    return res.status(403).json({ error: 'Geçersiz kurulum anahtarı' });

  const { name, email, password, dept, goalHours, theme, lang } = req.body;
  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'Ad, e-posta ve şifre zorunludur' });
  if (!validateEmail(email)) return res.status(400).json({ error: 'Geçersiz e-posta adresi' });
  if (password.length < 8)  return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Ad çok uzun' });

  const hash = await hashPasswordNew(password);
  const { lastInsertRowid: id } = q.insert.run(
    name.trim(), email.toLowerCase().trim(), hash,
    dept?.trim() || '', goalHours || 4, theme || 'light', lang || 'tr', 'admin'
  );
  setCookie(res, signToken({ id, role: 'admin', name: name.trim() }));
  res.json({ ok: true, user: safeUser(q.byId.get(id)) });
}));

// Kayıt ol
appRouter.post('/api/register', registerLimiter, asyncRoute(async (req, res) => {
  const { name, email, password, dept, goalHours, theme, lang } = req.body;
  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'Ad, e-posta ve şifre zorunludur' });
  if (!validateEmail(email)) return res.status(400).json({ error: 'Geçersiz e-posta adresi' });
  if (password.length < 8)  return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'Ad çok uzun' });

  if (q.byEmail.get(email.toLowerCase().trim()))
    return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı' });

  const hash = await hashPasswordNew(password);
  const { lastInsertRowid: id } = q.insert.run(
    name.trim(), email.toLowerCase().trim(), hash,
    dept?.trim() || '', goalHours || 4, theme || 'light', lang || 'tr', 'user'
  );
  setCookie(res, signToken({ id, role: 'user', name: name.trim() }));
  res.json({ ok: true, user: safeUser(q.byId.get(id)) });
}));

// Giriş yap
appRouter.post('/api/login', loginLimiter, asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password)
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur' });

  const row = q.byEmail.get(email.toLowerCase().trim());

  // Timing attack koruması: kullanıcı yoksa da PBKDF2 çalıştır
  const dummyHash = await getDummyHash();
  const match = row
    ? (isBcryptHash(row.password_hash)
        ? await bcrypt.compare(password, row.password_hash)
        : await verifyPasswordNew(password, row.password_hash))
    : (await verifyPasswordNew(password, dummyHash), false);

  if (!row || !match || !row.active)
    return res.status(401).json({ error: 'E-posta veya şifre hatalı' });

  // Bcrypt kullanıyorsa → PBKDF2'ye otomatik göç (yavaş hash'i hızlı sessizce değiştir)
  if (row && match && isBcryptHash(row.password_hash)) {
    try {
      const newHash = await hashPasswordNew(password);
      q.updatePasswordHash.run(row.id, newHash);
    } catch (_) { /* sessizce atla */ }
  }

  setCookie(res, signToken(row));
  res.json({ ok: true, user: safeUser(row) });
}));

// Çıkış yap
appRouter.post('/api/logout', (_req, res) => {
  res.clearCookie('studyo_token', { path: COOKIE_PATH });
  res.json({ ok: true });
});

// ── Spotify Proxy ──────────────────────────────────────────────────────────────
// Frontend Spotify'a direkt istek atmak yerine sunucu üzerinden proxy eder.
// Bu sayede connectSrc 'self' kalır ve token exchange client'ta görünmez.

appRouter.post('/api/spotify/token', requireAuth, asyncRoute(async (req, res) => {
  const { code, redirectUri, clientId, codeVerifier } = req.body;
  if (!code || !redirectUri || !clientId || !codeVerifier)
    return res.status(400).json({ error: 'Eksik Spotify parametresi' });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier,
    }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: data.error_description || data.error || 'Spotify hatası' });
  return res.json(data);
}));

appRouter.post('/api/spotify/refresh', requireAuth, asyncRoute(async (req, res) => {
  const { refreshToken, clientId } = req.body;
  if (!refreshToken || !clientId)
    return res.status(400).json({ error: 'Eksik Spotify parametresi' });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId,
    }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: data.error_description || data.error || 'Spotify yenileme hatası' });
  return res.json(data);
}));

// Mevcut kullanıcı
appRouter.get('/api/me', requireAuth, (req, res) => {
  const row = q.byId.get(req.user.id);
  if (!row || !row.active) {
    res.clearCookie('studyo_token', { path: COOKIE_PATH });
    return res.status(401).json({ error: 'Hesap bulunamadı veya devre dışı bırakıldı' });
  }
  res.json(safeUser(row));
});

appRouter.get('/api/app-state', requireAuth, (req, res) => {
  const user = q.byId.get(req.user.id);
  if (!user || !user.active) return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yapın' });

  let state = defaultAppState(user.goal_hours);
  const row = q.stateByUser.get(req.user.id);
  if (row) {
    try {
      state = sanitizeAppState(decryptJson(row), user.goal_hours);
    } catch (err) {
      console.warn('Şifreli durum çözülemedi, varsayılana dönüldü:', err.message);
    }
  }
  const files = q.filesByUser.all(req.user.id).map(safeUploadMeta);
  return res.json({ state, files });
});

appRouter.put('/api/app-state', requireAuth, (req, res) => {
  const user = q.byId.get(req.user.id);
  if (!user || !user.active) return res.status(401).json({ error: 'Oturum süresi doldu, tekrar giriş yapın' });

  const state = sanitizeAppState(req.body, user.goal_hours);
  const encrypted = encryptJson(state);
  q.upsertState.run(req.user.id, encrypted.encrypted, encrypted.iv, encrypted.authTag);
  return res.json({ ok: true, state });
});

appRouter.get('/api/files', requireAuth, (req, res) => {
  const files = q.filesByUser.all(req.user.id).map(safeUploadMeta);
  res.json({ files });
});

appRouter.post('/api/files/upload', requireAuth, runSingleUpload, asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadı' });

  const safeName = sanitizeFilename(req.file.originalname);
  if (!safeName) {
    await fsPromises.unlink(req.file.path).catch(() => {});
    return res.status(400).json({ error: 'Geçersiz dosya adı' });
  }

  const userDir = userUploadDir(req.user.id);
  fs.mkdirSync(userDir, { recursive: true });

  const storedName = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '')}.bin`;
  const targetPath = encryptedFilePath(req.user.id, storedName);
  let encryptedInfo;
  try {
    encryptedInfo = await encryptFileAtRest(req.file.path, targetPath);
  } finally {
    await fsPromises.unlink(req.file.path).catch(() => {});
  }

  const { lastInsertRowid } = q.insertFile.run(
    req.user.id,
    safeName,
    storedName,
    req.file.mimetype || 'application/octet-stream',
    req.file.size,
    encryptedInfo.iv,
    encryptedInfo.authTag,
  );

  const row = q.fileById.get(Number(lastInsertRowid), req.user.id);
  return res.status(201).json({ ok: true, file: safeUploadMeta(row) });
}));

appRouter.get('/api/files/:id/download', requireAuth, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz dosya ID' });

  const row = q.fileById.get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Dosya bulunamadı' });

  const filePath = encryptedFilePath(req.user.id, row.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Dosya diskte bulunamadı' });

  const encodedName = encodeURIComponent(row.original_name);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(row.size_bytes));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);

  await streamDecryptedFile(filePath, row.iv, row.auth_tag, res);
}));

appRouter.delete('/api/files/:id', requireAuth, asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz dosya ID' });

  const row = q.fileById.get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Dosya bulunamadı' });

  q.deleteFile.run(id, req.user.id);
  await fsPromises.unlink(encryptedFilePath(req.user.id, row.stored_name)).catch(() => {});
  return res.json({ ok: true });
}));

// ── Admin endpoint'leri ───────────────────────────────────────────────────────

appRouter.get('/api/admin/users', requireAdmin, (_req, res) => {
  res.json(q.allUsers.all());
});

appRouter.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  if (id === req.user.id)   return res.status(400).json({ error: 'Kendi hesabınızı değiştiremezsiniz' });

  const { role, active } = req.body;
  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Geçersiz rol' });
    q.setRole.run(role, id);
  }
  if (active !== undefined) q.setActive.run(active ? 1 : 0, id);
  res.json({ ok: true });
});

appRouter.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Geçersiz ID' });
  if (id === req.user.id)   return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
  const { changes } = q.delete.run(id);
  if (!changes) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  fs.rmSync(userUploadDir(id), { recursive: true, force: true });
  res.json({ ok: true });
});

// API hata yakalayıcı (async route hatalarıyla process çökmez)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Dosya boyutu 256 MB sınırını aşıyor' });
  }
  if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Tek seferde sadece bir dosya yüklenebilir' });
  }
  if (err?.code === 'UNSAFE_FILE_TYPE' || err?.code === 'INVALID_UPLOAD_NAME') {
    return res.status(400).json({ error: err.message });
  }

  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı' });
  }
  if (err?.code === 'SQLITE_BUSY' || err?.code === 'SQLITE_LOCKED') {
    return res.status(503).json({ error: 'Veritabanı meşgul. Birkaç saniye sonra tekrar deneyin.' });
  }

  console.error('Sunucu hatası:', err);
  return res.status(500).json({ error: 'Sunucu hatası oluştu. Terminal logunu kontrol edip tekrar deneyin.' });
});

// SPA fallback
appRouter.get('*', (_req, res) => res.sendFile(INDEX_FILE_PATH));

// ── Başlat ────────────────────────────────────────────────────────────────────
function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    const url = `http://localhost:${port}${withBasePath('/')}${APP_BASE_PATH === '/' ? '' : '/'}`;
    console.log(`\n  studyo  →  ${url}\n`);
    if (process.env.NODE_ENV !== 'production') openBrowser(url);
  });

  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Port ${port} kullanımda. ${nextPort} deneniyor...`);
      return startServer(nextPort, attempt + 1);
    }
    console.error('Sunucu başlatılamadı:', err);
    process.exit(1);
  });
}

startServer(PORT);
