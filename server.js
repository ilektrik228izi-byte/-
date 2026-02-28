const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TELEMETRY_FILE = path.join(DATA_DIR, 'telemetry.log.ndjson');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log.ndjson');

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '@username122333bot';
const TON_WALLET_ADDRESS = process.env.TON_WALLET_ADDRESS || '';
const TELEMETRY_ENABLED = String(process.env.TELEMETRY_ENABLED || 'true').toLowerCase() !== 'false';
const ROLE_ELEVATION_CODE = process.env.ROLE_ELEVATION_CODE || '';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change_me_admin_password';
const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC || 60 * 60 * 24 * 30);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);
const PAYMENTS_RATE_LIMIT_WINDOW_MS = Number(process.env.PAYMENTS_RATE_LIMIT_WINDOW_MS || 60_000);
const PAYMENTS_RATE_LIMIT_MAX = Number(process.env.PAYMENTS_RATE_LIMIT_MAX || 40);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 90);
const CONSENT_REQUIRED = String(process.env.CONSENT_REQUIRED || 'true').toLowerCase() !== 'false';
const DATABASE_URL = process.env.DATABASE_URL || '';
const REDIS_URL = process.env.REDIS_URL || '';

const ROLE_PERMISSIONS = {
  member: [],
  analyst: ['confidential:view', 'telemetry:view'],
  admin: ['confidential:view', 'telemetry:view', 'users:manage', 'payments:manage']
};

/** @type {Map<string, {user: any, csrfToken: string, expiresAt: number}>} */
const sessions = new Map();
const authRateBuckets = new Map();
const paymentsRateBuckets = new Map();

const metrics = {
  requests: 0,
  authLogin: 0,
  authRegister: 0,
  paymentCreate: 0,
  telemetryCollect: 0,
  reconcileRuns: 0
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const now = () => Date.now();
const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};

const writeJsonFile = (filePath, payload) => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

const readUsers = () => {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveUsers = (users) => {
  writeJsonFile(USERS_FILE, users);
};

const readPayments = () => {
  if (!fs.existsSync(PAYMENTS_FILE)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePayments = (payments) => {
  writeJsonFile(PAYMENTS_FILE, payments);
};

const createPasswordHash = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, encoded) => {
  const [salt, expectedHash] = String(encoded || '').split(':');
  if (!salt || !expectedHash) return false;
  const calculated = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const calculatedBuffer = Buffer.from(calculated, 'hex');
  if (expectedBuffer.length !== calculatedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
};

const toSessionPublicUser = (user) => ({
  id: user.id,
  username: user.username,
  telegram: user.telegram || '',
  role: user.role,
  score: Number(user.score || 0),
  consent: user.consent || { telemetry: true, marketing: false },
  permissions: ROLE_PERMISSIONS[user.role] || []
});

const ensureAdminUser = () => {
  const users = readUsers();
  const exists = users.some((user) => user.username.toLowerCase() === ADMIN_USERNAME.toLowerCase());
  if (exists) return;
  users.push({
    id: crypto.randomUUID(),
    username: ADMIN_USERNAME,
    telegram: '',
    role: 'admin',
    consent: { telemetry: true, marketing: false },
    score: 0,
    passwordHash: createPasswordHash(ADMIN_PASSWORD),
    createdAt: new Date().toISOString()
  });
  saveUsers(users);
  console.log(`Bootstrap admin created: ${ADMIN_USERNAME}`);
};

ensureAdminUser();

const pruneExpiredSessions = () => {
  const ts = now();
  for (const [sid, state] of sessions.entries()) {
    if (!state || state.expiresAt <= ts) sessions.delete(sid);
  }
};

const cleanupOldNdjson = (filePath, days) => {
  if (!fs.existsSync(filePath)) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  const kept = lines.filter((line) => {
    try {
      const parsed = JSON.parse(line);
      const ts = Date.parse(parsed?.server?.collectedAt || parsed?.createdAt || '');
      return Number.isFinite(ts) ? ts >= cutoff : true;
    } catch {
      return false;
    }
  });
  fs.writeFileSync(filePath, `${kept.join('\n')}${kept.length ? '\n' : ''}`);
};

setInterval(pruneExpiredSessions, 60_000).unref();
setInterval(() => {
  cleanupOldNdjson(TELEMETRY_FILE, RETENTION_DAYS);
  cleanupOldNdjson(AUDIT_FILE, RETENTION_DAYS);
}, 6 * 60 * 60 * 1000).unref();

const parseCookies = (req) => {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

const getIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
};

const collectServerContext = (req) => ({
  collectedAt: new Date().toISOString(),
  ip: getIp(req),
  userAgent: req.headers['user-agent'] || null,
  acceptLanguage: req.headers['accept-language'] || null,
  referer: req.headers.referer || null,
  origin: req.headers.origin || null,
  host: req.headers.host || null,
  method: req.method,
  path: req.url
});

const json = (res, statusCode, payload, extraHeaders = {}) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...securityHeaders,
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });

const appendNdjson = (filePath, payload) => {
  fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, (err) => {
    if (err) console.error(`Failed to write ${filePath}:`, err.message);
  });
};

const recordAudit = (req, action, details = {}) => {
  appendNdjson(AUDIT_FILE, {
    id: crypto.randomUUID(),
    action,
    details,
    server: collectServerContext(req)
  });
};

const getSessionState = (req) => {
  const sid = parseCookies(req).sid;
  if (!sid) return null;
  const state = sessions.get(sid);
  if (!state || state.expiresAt <= now()) {
    sessions.delete(sid);
    return null;
  }
  return { sid, state };
};

const getSessionUser = (req) => getSessionState(req)?.state.user || null;

const requireAuth = (req, res) => {
  const data = getSessionState(req);
  if (!data) {
    json(res, 401, { ok: false, error: 'Unauthorized' });
    return null;
  }
  return data;
};

const requirePermission = (req, res, permission) => {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  const permissions = ROLE_PERMISSIONS[auth.state.user.role] || [];
  if (!permissions.includes(permission)) {
    json(res, 403, { ok: false, error: 'Forbidden' });
    return null;
  }
  return auth;
};

const requireCsrf = (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  const token = req.headers['x-csrf-token'];
  if (!token || String(token) !== auth.state.csrfToken) {
    json(res, 403, { ok: false, error: 'Invalid CSRF token' });
    return null;
  }
  return auth;
};

const consumeRateLimit = (map, key, windowMs, maxRequests) => {
  const ts = now();
  const bucket = map.get(key);
  if (!bucket || bucket.resetAt <= ts) {
    map.set(key, { count: 1, resetAt: ts + windowMs });
    return { ok: true, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (bucket.count >= maxRequests) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - ts) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSec: Math.ceil((bucket.resetAt - ts) / 1000) };
};

const enforceRateLimit = (req, res, map, scope, windowMs, maxRequests) => {
  const key = `${scope}:${getIp(req)}`;
  const info = consumeRateLimit(map, key, windowMs, maxRequests);
  if (!info.ok) {
    json(res, 429, { ok: false, error: 'Too many requests', retryAfterSec: info.retryAfterSec });
    return false;
  }
  return true;
};

const createSession = (res, user) => {
  const sid = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = now() + SESSION_TTL_SEC * 1000;
  sessions.set(sid, { user, csrfToken, expiresAt });
  const securePart = COOKIE_SECURE ? '; Secure' : '';
  const cookie = `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}${securePart}`;
  return { sid, csrfToken, cookie };
};

const recalcUserScore = (user) => {
  const payments = readPayments().filter((p) => p.createdBy?.id === user.id);
  const confirmed = payments.filter((p) => p.status === 'confirmed').length;
  const delayed = payments.filter((p) => p.status === 'expired').length;
  user.score = Math.max(0, confirmed * 10 - delayed * 5);
};

const handleRegister = async (req, res) => {
  metrics.authRegister += 1;
  if (!enforceRateLimit(req, res, authRateBuckets, 'auth-register', AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX)) return;

  try {
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const telegram = String(body.telegram || '').trim().replace(/^@/, '');
    const accessCode = String(body.accessCode || '').trim();

    if (!username || !USERNAME_RE.test(username)) {
      json(res, 400, { ok: false, error: 'Username must be 3-32 chars: letters, numbers, underscore' });
      return;
    }
    if (!password || password.length < 8) {
      json(res, 400, { ok: false, error: 'Password too short (min 8)' });
      return;
    }

    const users = readUsers();
    const exists = users.some((user) => user.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      json(res, 409, { ok: false, error: 'User already exists' });
      return;
    }

    const role = accessCode && ROLE_ELEVATION_CODE && accessCode === ROLE_ELEVATION_CODE ? 'analyst' : 'member';
    const user = {
      id: crypto.randomUUID(),
      username,
      telegram,
      role,
      score: 0,
      consent: { telemetry: true, marketing: false },
      passwordHash: createPasswordHash(password),
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);
    const sessionUser = toSessionPublicUser(user);
    const { cookie, csrfToken } = createSession(res, sessionUser);
    recordAudit(req, 'auth.register', { username: sessionUser.username, role: sessionUser.role });
    json(res, 201, { ok: true, session: { ...sessionUser, csrfToken } }, { 'Set-Cookie': cookie });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const handleLogin = async (req, res) => {
  metrics.authLogin += 1;
  if (!enforceRateLimit(req, res, authRateBuckets, 'auth-login', AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX)) return;

  try {
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const accessCode = String(body.accessCode || '').trim();

    const users = readUsers();
    const user = users.find((item) => item.username.toLowerCase() === username.toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      json(res, 401, { ok: false, error: 'Invalid credentials' });
      return;
    }

    if (accessCode && ROLE_ELEVATION_CODE && accessCode === ROLE_ELEVATION_CODE && user.role === 'member') {
      user.role = 'analyst';
      saveUsers(users);
    }

    recalcUserScore(user);
    saveUsers(users);

    const sessionUser = toSessionPublicUser(user);
    const { cookie, csrfToken } = createSession(res, sessionUser);
    recordAudit(req, 'auth.login', { username: sessionUser.username, role: sessionUser.role });
    json(res, 200, { ok: true, session: { ...sessionUser, csrfToken } }, { 'Set-Cookie': cookie });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const handleSession = (req, res) => {
  const auth = getSessionState(req);
  if (!auth) {
    json(res, 200, { ok: true, session: null });
    return;
  }
  json(res, 200, { ok: true, session: { ...auth.state.user, csrfToken: auth.state.csrfToken } });
};

const handleLogout = (req, res) => {
  const auth = requireCsrf(req, res);
  if (!auth) return;
  sessions.delete(auth.sid);
  recordAudit(req, 'auth.logout', { username: auth.state.user.username });
  const securePart = COOKIE_SECURE ? '; Secure' : '';
  json(res, 200, { ok: true }, { 'Set-Cookie': `sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${securePart}` });
};

const handlePublicRuntime = (_req, res) => {
  json(res, 200, {
    ok: true,
    payments: { telegram_usdt: { recipient: TELEGRAM_BOT_USERNAME, wallet: TON_WALLET_ADDRESS } },
    legal: { consentRequired: CONSENT_REQUIRED, retentionDays: RETENTION_DAYS },
    infra: {
      postgresConfigured: Boolean(DATABASE_URL),
      redisConfigured: Boolean(REDIS_URL)
    }
  });
};

const handleGetConsent = (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  json(res, 200, { ok: true, consent: auth.state.user.consent || { telemetry: true, marketing: false } });
};

const handleSetConsent = async (req, res) => {
  const auth = requireCsrf(req, res);
  if (!auth) return;

  try {
    const body = await readBody(req);
    const telemetry = Boolean(body.telemetry);
    const marketing = Boolean(body.marketing);
    const users = readUsers();
    const user = users.find((u) => u.id === auth.state.user.id);
    if (!user) {
      json(res, 404, { ok: false, error: 'User not found' });
      return;
    }

    user.consent = { telemetry, marketing };
    saveUsers(users);
    auth.state.user = toSessionPublicUser(user);
    recordAudit(req, 'user.consent.update', { username: user.username, consent: user.consent });
    json(res, 200, { ok: true, consent: user.consent });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const handleTelemetryCollect = async (req, res) => {
  metrics.telemetryCollect += 1;
  if (!TELEMETRY_ENABLED) {
    json(res, 200, { ok: true, telemetryEnabled: false });
    return;
  }

  try {
    const body = await readBody(req);
    const sessionUser = getSessionUser(req);
    if (CONSENT_REQUIRED && sessionUser && sessionUser.consent && sessionUser.consent.telemetry === false) {
      json(res, 200, { ok: true, skipped: 'consent_disabled' });
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      event: String(body.event || 'unknown').slice(0, 200),
      user: sessionUser ? { id: sessionUser.id, username: sessionUser.username, role: sessionUser.role } : null,
      page: body.page || null,
      client: body.client || null,
      extra: body.extra || null,
      server: collectServerContext(req)
    };

    appendNdjson(TELEMETRY_FILE, record);
    json(res, 200, { ok: true, id: record.id });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const parseNdjson = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

const handleTelemetrySummary = (req, res) => {
  const auth = requirePermission(req, res, 'telemetry:view');
  if (!auth) return;

  const parsed = parseNdjson(TELEMETRY_FILE);
  json(res, 200, {
    ok: true,
    requestedBy: auth.state.user.username,
    totalEvents: parsed.length,
    uniqueUsers: new Set(parsed.map((item) => item.user?.username).filter(Boolean)).size,
    lastEvents: parsed.slice(-10)
  });
};

const handleCreateCryptoPayment = async (req, res) => {
  metrics.paymentCreate += 1;
  if (!enforceRateLimit(req, res, paymentsRateBuckets, 'payments-create', PAYMENTS_RATE_LIMIT_WINDOW_MS, PAYMENTS_RATE_LIMIT_MAX)) return;

  const auth = requireCsrf(req, res);
  if (!auth) return;

  try {
    const body = await readBody(req);
    const amount = Number(body.amount);
    const idempotencyKey = String(body.idempotencyKey || req.headers['idempotency-key'] || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      json(res, 400, { ok: false, error: 'amount must be a positive number' });
      return;
    }
    if (!idempotencyKey || idempotencyKey.length < 8) {
      json(res, 400, { ok: false, error: 'idempotencyKey is required (min 8 chars)' });
      return;
    }

    const payments = readPayments();
    const existing = payments.find(
      (p) => p.createdBy?.id === auth.state.user.id && p.idempotencyKey === idempotencyKey
    );

    if (existing) {
      json(res, 200, {
        ok: true,
        reused: true,
        paymentId: existing.paymentId,
        status: existing.status,
        deepLink: existing.deepLink,
        network: existing.network,
        recipient: existing.recipient,
        wallet: existing.wallet
      });
      return;
    }

    const paymentId = crypto.randomUUID();
    const description = String(body.description || 'Пополнение счёта').slice(0, 200);
    const usernameWithoutAt = TELEGRAM_BOT_USERNAME.replace(/^@/, '');
    const deepLinkText = encodeURIComponent(`Оплата ${amount.toFixed(2)} RUB | ${description} | ${paymentId}`);
    const deepLink = `https://t.me/${usernameWithoutAt}?start=${deepLinkText}`;

    const payment = {
      paymentId,
      idempotencyKey,
      amount: amount.toFixed(2),
      method: 'telegram_usdt',
      network: 'TON / USDT (TON)',
      recipient: TELEGRAM_BOT_USERNAME,
      wallet: TON_WALLET_ADDRESS,
      deepLink,
      status: 'pending_onchain',
      history: [{ status: 'pending_onchain', at: new Date().toISOString() }],
      txHash: null,
      description,
      metadata: body.metadata || null,
      createdBy: { id: auth.state.user.id, username: auth.state.user.username, role: auth.state.user.role },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      server: collectServerContext(req)
    };

    payments.push(payment);
    savePayments(payments);
    recordAudit(req, 'payment.create', { paymentId, username: auth.state.user.username, amount: payment.amount });

    json(res, 200, {
      ok: true,
      paymentId,
      status: payment.status,
      method: payment.method,
      recipient: payment.recipient,
      wallet: payment.wallet,
      network: payment.network,
      deepLink: payment.deepLink,
      instructions: 'Переведите USDT в сети TON на кошелёк и отправьте tx-hash оператору в Telegram.'
    });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const updatePaymentStatus = (payment, status, extra = {}) => {
  payment.status = status;
  payment.updatedAt = new Date().toISOString();
  payment.history = payment.history || [];
  payment.history.push({ status, at: payment.updatedAt, ...extra });
};

const handleConfirmOnchain = async (req, res) => {
  const auth = requirePermission(req, res, 'payments:manage');
  if (!auth) return;

  try {
    const body = await readBody(req);
    const paymentId = String(body.paymentId || '').trim();
    const txHash = String(body.txHash || '').trim();
    if (!paymentId || !txHash) {
      json(res, 400, { ok: false, error: 'paymentId and txHash are required' });
      return;
    }

    const payments = readPayments();
    const payment = payments.find((p) => p.paymentId === paymentId);
    if (!payment) {
      json(res, 404, { ok: false, error: 'Payment not found' });
      return;
    }

    payment.txHash = txHash;
    updatePaymentStatus(payment, 'confirmed', { txHash, confirmedBy: auth.state.user.username });
    savePayments(payments);
    recordAudit(req, 'payment.confirm_onchain', { paymentId, txHash, by: auth.state.user.username });

    const users = readUsers();
    const user = users.find((u) => u.id === payment.createdBy?.id);
    if (user) {
      recalcUserScore(user);
      saveUsers(users);
      for (const state of sessions.values()) {
        if (state.user.id === user.id) {
          state.user = toSessionPublicUser(user);
        }
      }
    }

    json(res, 200, { ok: true, paymentId, status: payment.status, txHash });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const handleReconcile = (_req, res) => {
  metrics.reconcileRuns += 1;
  const payments = readPayments();
  const nowTs = Date.now();
  let changed = 0;

  payments.forEach((payment) => {
    if (payment.status !== 'pending_onchain') return;
    const createdTs = Date.parse(payment.createdAt || '');
    if (Number.isFinite(createdTs) && nowTs - createdTs > 3 * 24 * 60 * 60 * 1000) {
      updatePaymentStatus(payment, 'expired');
      changed += 1;
    }
  });

  if (changed) {
    savePayments(payments);
  }

  json(res, 200, { ok: true, changed, total: payments.length });
};

const handleHealth = (_req, res) => {
  json(res, 200, {
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    sessionCount: sessions.size,
    telemetryEnabled: TELEMETRY_ENABLED,
    retentionDays: RETENTION_DAYS,
    infra: {
      postgresConfigured: Boolean(DATABASE_URL),
      redisConfigured: Boolean(REDIS_URL)
    }
  });
};

const handleMetrics = (_req, res) => {
  const lines = [
    '# TYPE odkb_requests_total counter',
    `odkb_requests_total ${metrics.requests}`,
    '# TYPE odkb_auth_login_total counter',
    `odkb_auth_login_total ${metrics.authLogin}`,
    '# TYPE odkb_auth_register_total counter',
    `odkb_auth_register_total ${metrics.authRegister}`,
    '# TYPE odkb_payment_create_total counter',
    `odkb_payment_create_total ${metrics.paymentCreate}`,
    '# TYPE odkb_telemetry_collect_total counter',
    `odkb_telemetry_collect_total ${metrics.telemetryCollect}`,
    '# TYPE odkb_reconcile_runs_total counter',
    `odkb_reconcile_runs_total ${metrics.reconcileRuns}`,
    '# TYPE odkb_sessions gauge',
    `odkb_sessions ${sessions.size}`
  ];
  res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', ...securityHeaders });
  res.end(`${lines.join('\n')}\n`);
};

const handleAdminUsers = (req, res) => {
  const auth = requirePermission(req, res, 'users:manage');
  if (!auth) return;

  const users = readUsers().map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    score: Number(user.score || 0),
    telegram: user.telegram || '',
    consent: user.consent || { telemetry: true, marketing: false },
    createdAt: user.createdAt
  }));

  json(res, 200, { ok: true, requestedBy: auth.state.user.username, total: users.length, users });
};

const handleAdminRoleUpdate = async (req, res) => {
  const auth = requirePermission(req, res, 'users:manage');
  if (!auth) return;

  try {
    const body = await readBody(req);
    const userId = String(body.userId || '').trim();
    const role = String(body.role || '').trim();
    if (!userId || !ROLE_PERMISSIONS[role]) {
      json(res, 400, { ok: false, error: 'Invalid userId or role' });
      return;
    }

    const users = readUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
      json(res, 404, { ok: false, error: 'User not found' });
      return;
    }

    user.role = role;
    saveUsers(users);

    for (const state of sessions.values()) {
      if (state.user.id === user.id) {
        state.user = toSessionPublicUser(user);
      }
    }

    recordAudit(req, 'admin.user_role_update', { by: auth.state.user.username, userId, role });
    json(res, 200, { ok: true, user: toSessionPublicUser(user) });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const handleAdminPayments = (req, res) => {
  const auth = requirePermission(req, res, 'payments:manage');
  if (!auth) return;

  const payments = readPayments();
  json(res, 200, { ok: true, total: payments.length, payments: payments.slice(-200).reverse() });
};

const handleAdminTelemetry = (req, res) => {
  const auth = requirePermission(req, res, 'telemetry:view');
  if (!auth) return;

  const events = parseNdjson(TELEMETRY_FILE);
  const byEvent = events.reduce((acc, item) => {
    const key = item.event || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  json(res, 200, {
    ok: true,
    total: events.length,
    topEvents: Object.entries(byEvent).sort((a, b) => b[1] - a[1]).slice(0, 10)
  });
};

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const serveStatic = (req, res) => {
  const basePath = req.url.split('?')[0];
  const requestedPath = basePath === '/' ? '/index.html' : basePath;
  const safePath = path.normalize(requestedPath).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, securityHeaders);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, file) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream', ...securityHeaders });
    res.end(file);
  });
};

const server = http.createServer((req, res) => {
  metrics.requests += 1;

  if (req.method === 'GET' && req.url === '/api/health') return void handleHealth(req, res);
  if (req.method === 'GET' && req.url === '/metrics') return void handleMetrics(req, res);

  if (req.method === 'POST' && req.url === '/api/auth/register') return void handleRegister(req, res);
  if (req.method === 'POST' && req.url === '/api/auth/login') return void handleLogin(req, res);
  if (req.method === 'GET' && req.url === '/api/auth/session') return void handleSession(req, res);
  if (req.method === 'POST' && req.url === '/api/auth/logout') return void handleLogout(req, res);

  if (req.method === 'GET' && req.url === '/api/public/runtime') return void handlePublicRuntime(req, res);
  if (req.method === 'GET' && req.url === '/api/user/consent') return void handleGetConsent(req, res);
  if (req.method === 'POST' && req.url === '/api/user/consent') return void handleSetConsent(req, res);

  if (req.method === 'POST' && req.url === '/api/payments/telegram-crypto/create') return void handleCreateCryptoPayment(req, res);
  if (req.method === 'POST' && req.url === '/api/payments/confirm-onchain') return void handleConfirmOnchain(req, res);
  if (req.method === 'POST' && req.url === '/api/jobs/reconcile') return void handleReconcile(req, res);

  if (req.method === 'POST' && req.url === '/api/telemetry/collect') return void handleTelemetryCollect(req, res);
  if (req.method === 'GET' && req.url === '/api/telemetry/summary') return void handleTelemetrySummary(req, res);
  if (req.method === 'GET' && req.url === '/api/admin/telemetry') return void handleAdminTelemetry(req, res);

  if (req.method === 'GET' && req.url === '/api/admin/users') return void handleAdminUsers(req, res);
  if (req.method === 'POST' && req.url === '/api/admin/users/role') return void handleAdminRoleUpdate(req, res);
  if (req.method === 'GET' && req.url === '/api/admin/payments') return void handleAdminPayments(req, res);

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
