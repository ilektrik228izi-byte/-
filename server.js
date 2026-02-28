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
const INVITES_FILE = path.join(DATA_DIR, 'invite_tokens.json');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const DSR_FILE = path.join(DATA_DIR, 'data_subject_requests.json');

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '@username122333bot';
const TON_WALLET_ADDRESS = process.env.TON_WALLET_ADDRESS || '';
const TELEMETRY_ENABLED = String(process.env.TELEMETRY_ENABLED || 'true').toLowerCase() !== 'false';
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
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const INVOICE_TTL_SEC = Number(process.env.INVOICE_TTL_SEC || 24 * 60 * 60);
const USDT_RATE_RUB = Number(process.env.USDT_RATE_RUB || 95);
const DAILY_LIMIT_MEMBER_RUB = Number(process.env.DAILY_LIMIT_MEMBER_RUB || 50000);
const DAILY_LIMIT_ANALYST_RUB = Number(process.env.DAILY_LIMIT_ANALYST_RUB || 200000);
const ACTIVE_LIMIT_MEMBER = Number(process.env.ACTIVE_LIMIT_MEMBER || 3);
const ACTIVE_LIMIT_ANALYST = Number(process.env.ACTIVE_LIMIT_ANALYST || 10);

const ROLE_PERMISSIONS = {
  member: ['payments:create'],
  analyst: ['payments:create', 'confidential:view', 'telemetry:view'],
  admin: ['payments:create', 'payments:manage', 'confidential:view', 'telemetry:view', 'users:manage']
};

const sessions = new Map();
const authRateBuckets = new Map();
const paymentsRateBuckets = new Map();
const metrics = {
  requests: 0,
  authLogin: 0,
  authRegister: 0,
  paymentCreate: 0,
  telemetryCollect: 0,
  reconcileRuns: 0,
  queueProcessed: 0
};
const jobQueue = [];

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const now = () => Date.now();
const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;
const EVENT_RE = /^[a-z0-9_:.\-]{2,80}$/i;

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'"
};

const writeJsonFile = (filePath, payload) => fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
const readJsonArray = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const readUsers = () => readJsonArray(USERS_FILE);
const saveUsers = (users) => writeJsonFile(USERS_FILE, users);
const readPayments = () => readJsonArray(PAYMENTS_FILE);
const savePayments = (payments) => writeJsonFile(PAYMENTS_FILE, payments);
const readInvites = () => readJsonArray(INVITES_FILE);
const saveInvites = (invites) => writeJsonFile(INVITES_FILE, invites);
const readTickets = () => readJsonArray(TICKETS_FILE);
const saveTickets = (tickets) => writeJsonFile(TICKETS_FILE, tickets);
const readNotifications = () => readJsonArray(NOTIFICATIONS_FILE);
const saveNotifications = (items) => writeJsonFile(NOTIFICATIONS_FILE, items);
const readDsr = () => readJsonArray(DSR_FILE);
const saveDsr = (items) => writeJsonFile(DSR_FILE, items);

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
  kycLevel: user.kycLevel || 'basic',
  score: Number(user.score || 0),
  consent: user.consent || { telemetry: true, marketing: false },
  permissions: ROLE_PERMISSIONS[user.role] || []
});

const ensureAdminUser = () => {
  const users = readUsers();
  const exists = users.some((u) => u.username.toLowerCase() === ADMIN_USERNAME.toLowerCase());
  if (exists) return;
  users.push({
    id: crypto.randomUUID(),
    username: ADMIN_USERNAME,
    telegram: '',
    role: 'admin',
    score: 0,
    consent: { telemetry: true, marketing: false },
    passwordHash: createPasswordHash(ADMIN_PASSWORD),
    createdAt: new Date().toISOString(),
    passwordChangedAt: new Date().toISOString(),
    passwordHistory: []
  });
  saveUsers(users);
};
ensureAdminUser();

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

const readBody = (req) => new Promise((resolve, reject) => {
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
  fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, () => {});
};

const recordAudit = (req, action, details = {}) => {
  appendNdjson(AUDIT_FILE, { id: crypto.randomUUID(), action, details, server: collectServerContext(req) });
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
  const auth = getSessionState(req);
  if (!auth) {
    json(res, 401, { ok: false, error: 'Unauthorized' });
    return null;
  }
  return auth;
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
  if (bucket.count >= maxRequests) return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - ts) / 1000) };
  bucket.count += 1;
  return { ok: true, retryAfterSec: Math.ceil((bucket.resetAt - ts) / 1000) };
};

const enforceRateLimit = (req, res, map, scope, windowMs, maxRequests, extraKey = '') => {
  const base = `${scope}:${getIp(req)}`;
  const ipRes = consumeRateLimit(map, base, windowMs, maxRequests);
  if (!ipRes.ok) {
    json(res, 429, { ok: false, error: 'Too many requests', retryAfterSec: ipRes.retryAfterSec });
    return false;
  }

  if (extraKey) {
    const keyed = consumeRateLimit(map, `${scope}:user:${extraKey}`, windowMs, maxRequests);
    if (!keyed.ok) {
      json(res, 429, { ok: false, error: 'Too many requests', retryAfterSec: keyed.retryAfterSec });
      return false;
    }
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

const consumeInviteToken = (token) => {
  if (!token) return null;
  const invites = readInvites();
  const idx = invites.findIndex((i) => i.token === token && !i.usedAt && (!i.expiresAt || Date.parse(i.expiresAt) > Date.now()));
  if (idx < 0) return null;
  invites[idx].usedAt = new Date().toISOString();
  saveInvites(invites);
  return invites[idx];
};

const recalcUserScore = (user) => {
  const payments = readPayments().filter((p) => p.createdBy?.id === user.id);
  const confirmed = payments.filter((p) => p.status === 'confirmed').length;
  const refunded = payments.filter((p) => p.status === 'refunded').length;
  const expired = payments.filter((p) => p.status === 'expired').length;
  user.score = Math.max(0, confirmed * 10 - refunded * 7 - expired * 5);
};

const updatePaymentStatus = (payment, status, extra = {}) => {
  payment.status = status;
  payment.updatedAt = new Date().toISOString();
  payment.history = payment.history || [];
  payment.history.push({ status, at: payment.updatedAt, ...extra });
};

const pushNotification = (userId, type, message, meta = {}) => {
  const items = readNotifications();
  items.push({ id: crypto.randomUUID(), userId, type, message, meta, createdAt: new Date().toISOString(), read: false });
  saveNotifications(items);
};

const getRoleLimits = (role, kycLevel) => {
  const daily = role === 'analyst' ? DAILY_LIMIT_ANALYST_RUB : DAILY_LIMIT_MEMBER_RUB;
  const active = role === 'analyst' ? ACTIVE_LIMIT_ANALYST : ACTIVE_LIMIT_MEMBER;
  if (kycLevel === 'advanced') {
    return { maxDailyRub: daily * 2, maxActiveDeals: active * 2 };
  }
  return { maxDailyRub: daily, maxActiveDeals: active };
};

const computeTodayVolume = (payments, userId) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const ts = start.getTime();
  return payments
    .filter((p) => p.createdBy?.id === userId && Date.parse(p.createdAt || '') >= ts)
    .reduce((sum, p) => sum + Number(p.amountRub || 0), 0);
};

const countActiveDeals = (payments, userId) =>
  payments.filter((p) => p.createdBy?.id === userId && ['draft', 'pending_chain', 'pending_onchain'].includes(p.status)).length;

const verifyTxHashWithProvider = async (txHash) => {
  const valid = /^[a-fA-F0-9]{32,128}$/.test(txHash);
  return { verified: valid, provider: 'simulated_ton_provider', checkedAt: new Date().toISOString() };
};

const classifyTelemetry = (event) => {
  if (String(event).includes('login') || String(event).includes('register')) return 'auth_pii';
  return 'behavior_non_pii';
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

const cleanupOldNdjson = (filePath, days) => {
  if (!fs.existsSync(filePath)) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const kept = parseNdjson(filePath).filter((item) => {
    const ts = Date.parse(item?.server?.collectedAt || item?.createdAt || '');
    return Number.isFinite(ts) ? ts >= cutoff : true;
  });
  fs.writeFileSync(filePath, `${kept.map((x) => JSON.stringify(x)).join('\n')}${kept.length ? '\n' : ''}`);
};

const runReconcile = () => {
  metrics.reconcileRuns += 1;
  const payments = readPayments();
  let changed = 0;
  const cutoff = Date.now() - INVOICE_TTL_SEC * 1000;
  payments.forEach((payment) => {
    if (!['draft', 'pending_chain', 'pending_onchain'].includes(payment.status)) return;
    const createdTs = Date.parse(payment.createdAt || '');
    if (Number.isFinite(createdTs) && createdTs < cutoff) {
      updatePaymentStatus(payment, 'expired', { reason: 'ttl_expired' });
      changed += 1;
    }
  });
  if (changed) savePayments(payments);
  return { changed, total: payments.length };
};

setInterval(() => {
  const job = jobQueue.shift();
  if (!job) return;
  if (job.type === 'reconcile') {
    runReconcile();
    metrics.queueProcessed += 1;
  }
}, 3000).unref();

setInterval(() => {
  for (const [sid, state] of sessions.entries()) {
    if (!state || state.expiresAt <= now()) sessions.delete(sid);
  }
  cleanupOldNdjson(TELEMETRY_FILE, RETENTION_DAYS);
  cleanupOldNdjson(AUDIT_FILE, RETENTION_DAYS);
}, 60_000).unref();

const authService = {
  async register(req, res) {
    metrics.authRegister += 1;
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    if (!enforceRateLimit(req, res, authRateBuckets, 'auth-register', AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX, username.toLowerCase())) return;

    const password = String(body.password || '');
    const telegram = String(body.telegram || '').trim().replace(/^@/, '');
    const inviteToken = String(body.accessCode || '').trim();

    if (!username || !USERNAME_RE.test(username)) return json(res, 400, { ok: false, error: 'Username must be 3-32 chars: letters, numbers, underscore' });
    if (!password || password.length < 8) return json(res, 400, { ok: false, error: 'Password too short (min 8)' });

    const users = readUsers();
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return json(res, 409, { ok: false, error: 'User already exists' });

    const invite = consumeInviteToken(inviteToken);
    const role = invite?.role || 'member';

    const user = {
      id: crypto.randomUUID(),
      username,
      telegram,
      role,
      kycLevel: 'basic',
      score: 0,
      consent: { telemetry: true, marketing: false },
      passwordHash: createPasswordHash(password),
      passwordChangedAt: new Date().toISOString(),
      passwordHistory: [],
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);

    const sessionUser = toSessionPublicUser(user);
    const { cookie, csrfToken } = createSession(res, sessionUser);
    recordAudit(req, 'auth.register', { username: sessionUser.username, role: sessionUser.role });
    json(res, 201, { ok: true, session: { ...sessionUser, csrfToken } }, { 'Set-Cookie': cookie });
  },

  async login(req, res) {
    metrics.authLogin += 1;
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    if (!enforceRateLimit(req, res, authRateBuckets, 'auth-login', AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX, username.toLowerCase())) return;

    const password = String(body.password || '');
    const inviteToken = String(body.accessCode || '').trim();
    const users = readUsers();
    const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) return json(res, 401, { ok: false, error: 'Invalid credentials' });

    const invite = consumeInviteToken(inviteToken);
    if (invite && user.role === 'member') user.role = invite.role || 'analyst';
    recalcUserScore(user);
    saveUsers(users);

    const sessionUser = toSessionPublicUser(user);
    const { cookie, csrfToken } = createSession(res, sessionUser);
    recordAudit(req, 'auth.login', { username: sessionUser.username, role: sessionUser.role });
    json(res, 200, { ok: true, session: { ...sessionUser, csrfToken } }, { 'Set-Cookie': cookie });
  }
};

const paymentService = {
  async create(req, res) {
    metrics.paymentCreate += 1;
    if (!enforceRateLimit(req, res, paymentsRateBuckets, 'payments-create', PAYMENTS_RATE_LIMIT_WINDOW_MS, PAYMENTS_RATE_LIMIT_MAX)) return;
    const auth = requireCsrf(req, res);
    if (!auth) return;

    const body = await readBody(req);
    const amountRub = Number(body.amount);
    const idempotencyKey = String(body.idempotencyKey || req.headers['idempotency-key'] || '').trim();
    if (!Number.isFinite(amountRub) || amountRub <= 0) return json(res, 400, { ok: false, error: 'amount must be a positive number' });
    if (!idempotencyKey || idempotencyKey.length < 8) return json(res, 400, { ok: false, error: 'idempotencyKey is required (min 8 chars)' });

    const payments = readPayments();
    const limits = getRoleLimits(auth.state.user.role, auth.state.user.kycLevel || 'basic');
    const todayVolume = computeTodayVolume(payments, auth.state.user.id);
    const activeDeals = countActiveDeals(payments, auth.state.user.id);
    if (todayVolume + amountRub > limits.maxDailyRub) return json(res, 400, { ok: false, error: `Daily limit exceeded (${limits.maxDailyRub} RUB)` });
    if (activeDeals >= limits.maxActiveDeals) return json(res, 400, { ok: false, error: `Active deals limit exceeded (${limits.maxActiveDeals})` });
    const existing = payments.find((p) => p.createdBy?.id === auth.state.user.id && p.idempotencyKey === idempotencyKey);
    if (existing) {
      return json(res, 200, {
        ok: true,
        reused: true,
        paymentId: existing.paymentId,
        status: existing.status,
        deepLink: existing.deepLink,
        network: existing.network,
        recipient: existing.recipient,
        wallet: existing.wallet
      });
    }

    const paymentId = crypto.randomUUID();
    const description = String(body.description || 'Пополнение счёта').slice(0, 200);
    const amountUsdt = (amountRub / USDT_RATE_RUB).toFixed(2);
    const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME.replace(/^@/, '')}?start=${encodeURIComponent(`pay_${paymentId}_${amountRub.toFixed(2)}`)}`;

    const payment = {
      paymentId,
      idempotencyKey,
      amountRub: amountRub.toFixed(2),
      amountUsdt,
      rateRubUsdt: USDT_RATE_RUB,
      method: 'telegram_usdt',
      network: 'TON / USDT (TON)',
      recipient: TELEGRAM_BOT_USERNAME,
      wallet: TON_WALLET_ADDRESS,
      deepLink,
      status: 'draft',
      history: [{ status: 'draft', at: new Date().toISOString() }],
      txHash: null,
      description,
      metadata: body.metadata || null,
      createdBy: { id: auth.state.user.id, username: auth.state.user.username, role: auth.state.user.role },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      server: collectServerContext(req)
    };

    updatePaymentStatus(payment, 'pending_chain', { reason: 'invoice_issued' });
    payments.push(payment);
    savePayments(payments);
    recordAudit(req, 'payment.create', { paymentId, username: auth.state.user.username, amountRub: payment.amountRub });
    pushNotification(auth.state.user.id, 'payment_created', `Платёж ${paymentId} создан`, { paymentId });

    json(res, 200, {
      ok: true,
      paymentId,
      status: payment.status,
      recipient: payment.recipient,
      wallet: payment.wallet,
      network: payment.network,
      amountUsdt: payment.amountUsdt,
      rateRubUsdt: payment.rateRubUsdt,
      deepLink: payment.deepLink
    });
  },

  async confirmOnchain(req, res) {
    const auth = requirePermission(req, res, 'payments:manage');
    if (!auth) return;
    const body = await readBody(req);
    const paymentId = String(body.paymentId || '').trim();
    const txHash = String(body.txHash || '').trim();
    if (!paymentId || !txHash) return json(res, 400, { ok: false, error: 'paymentId and txHash are required' });

    const verify = await verifyTxHashWithProvider(txHash);
    if (!verify.verified) return json(res, 400, { ok: false, error: 'txHash verification failed' });

    const payments = readPayments();
    const limits = getRoleLimits(auth.state.user.role, auth.state.user.kycLevel || 'basic');
    const todayVolume = computeTodayVolume(payments, auth.state.user.id);
    const activeDeals = countActiveDeals(payments, auth.state.user.id);
    const payment = payments.find((p) => p.paymentId === paymentId);
    if (!payment) return json(res, 404, { ok: false, error: 'Payment not found' });

    payment.txHash = txHash;
    updatePaymentStatus(payment, 'confirmed', { txHash, confirmedBy: auth.state.user.username, provider: verify.provider });
    savePayments(payments);
    recordAudit(req, 'payment.confirm_onchain', { paymentId, txHash, by: auth.state.user.username });
    if (payment.createdBy?.id) {
      pushNotification(payment.createdBy.id, 'payment_confirmed', `Платёж ${paymentId} подтверждён`, { paymentId, txHash });
    }

    const users = readUsers();
    const user = users.find((u) => u.id === payment.createdBy?.id);
    if (user) {
      recalcUserScore(user);
      saveUsers(users);
      for (const state of sessions.values()) {
        if (state.user.id === user.id) state.user = toSessionPublicUser(user);
      }
    }

    json(res, 200, { ok: true, paymentId, status: payment.status, txHash, verification: verify });
  }
};

const telemetryService = {
  async collect(req, res) {
    metrics.telemetryCollect += 1;
    if (!TELEMETRY_ENABLED) return json(res, 200, { ok: true, telemetryEnabled: false });
    const body = await readBody(req);
    const sessionUser = getSessionUser(req);

    if (CONSENT_REQUIRED && sessionUser?.consent?.telemetry === false) {
      return json(res, 200, { ok: true, skipped: 'consent_disabled' });
    }

    const event = String(body.event || 'unknown').slice(0, 200);
    if (!EVENT_RE.test(event)) return json(res, 400, { ok: false, error: 'Invalid event format' });

    const record = {
      id: crypto.randomUUID(),
      version: Number(body.version || 1),
      piiClass: classifyTelemetry(event),
      event,
      user: sessionUser ? { id: sessionUser.id, username: sessionUser.username, role: sessionUser.role } : null,
      page: body.page || null,
      client: body.client || null,
      extra: body.extra || null,
      server: collectServerContext(req)
    };

    appendNdjson(TELEMETRY_FILE, record);
    json(res, 200, { ok: true, id: record.id });
  }
};

const handleSession = (req, res) => {
  const auth = getSessionState(req);
  if (!auth) return json(res, 200, { ok: true, session: null });
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
    infra: { postgresConfigured: Boolean(DATABASE_URL), redisConfigured: Boolean(REDIS_URL) }
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
  const body = await readBody(req);
  const users = readUsers();
  const user = users.find((u) => u.id === auth.state.user.id);
  if (!user) return json(res, 404, { ok: false, error: 'User not found' });
  user.consent = { telemetry: Boolean(body.telemetry), marketing: Boolean(body.marketing) };
  saveUsers(users);
  auth.state.user = toSessionPublicUser(user);
  recordAudit(req, 'user.consent.update', { username: user.username, consent: user.consent });
  json(res, 200, { ok: true, consent: user.consent });
};

const handleTelemetrySummary = (req, res) => {
  const auth = requirePermission(req, res, 'telemetry:view');
  if (!auth) return;
  const events = parseNdjson(TELEMETRY_FILE);
  json(res, 200, {
    ok: true,
    requestedBy: auth.state.user.username,
    totalEvents: events.length,
    uniqueUsers: new Set(events.map((e) => e.user?.username).filter(Boolean)).size,
    lastEvents: events.slice(-10)
  });
};

const handleAdminTelemetry = (req, res) => {
  const auth = requirePermission(req, res, 'telemetry:view');
  if (!auth) return;
  const events = parseNdjson(TELEMETRY_FILE);
  const counts = events.reduce((acc, e) => {
    acc[e.event] = (acc[e.event] || 0) + 1;
    return acc;
  }, {});

  const funnel = {
    register: counts.register_success || 0,
    login: counts.login_success || 0,
    firstPayment: counts.payment_submit_success || 0,
    repeatPayment: Math.max(0, (counts.payment_submit_success || 0) - 1)
  };

  json(res, 200, {
    ok: true,
    total: events.length,
    topEvents: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    funnel
  });
};

const handleAdminAnomalies = (req, res) => {
  const auth = requirePermission(req, res, 'telemetry:view');
  if (!auth) return;
  const events = parseNdjson(TELEMETRY_FILE);
  const perIp = events.reduce((acc, e) => {
    const ip = e?.server?.ip || 'unknown';
    acc[ip] = (acc[ip] || 0) + 1;
    return acc;
  }, {});
  const anomalies = Object.entries(perIp).filter(([, c]) => c >= 50).map(([ip, count]) => ({ ip, count, reason: 'burst_activity' }));
  json(res, 200, { ok: true, anomalies });
};

const handleAdminUsers = (req, res) => {
  const auth = requirePermission(req, res, 'users:manage');
  if (!auth) return;
  const users = readUsers().map((u) => ({ id: u.id, username: u.username, role: u.role, score: Number(u.score || 0), telegram: u.telegram || '', consent: u.consent || { telemetry: true, marketing: false }, createdAt: u.createdAt }));
  json(res, 200, { ok: true, requestedBy: auth.state.user.username, total: users.length, users });
};

const handleAdminRoleUpdate = async (req, res) => {
  const auth = requirePermission(req, res, 'users:manage');
  if (!auth) return;
  const body = await readBody(req);
  const userId = String(body.userId || '').trim();
  const role = String(body.role || '').trim();
  if (!userId || !ROLE_PERMISSIONS[role]) return json(res, 400, { ok: false, error: 'Invalid userId or role' });
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return json(res, 404, { ok: false, error: 'User not found' });
  user.role = role;
  saveUsers(users);
  for (const state of sessions.values()) if (state.user.id === user.id) state.user = toSessionPublicUser(user);
  recordAudit(req, 'admin.user_role_update', { by: auth.state.user.username, userId, role });
  json(res, 200, { ok: true, user: toSessionPublicUser(user) });
};

const handleAdminInviteCreate = async (req, res) => {
  const auth = requirePermission(req, res, 'users:manage');
  if (!auth) return;
  const body = await readBody(req);
  const role = String(body.role || 'analyst');
  if (!ROLE_PERMISSIONS[role]) return json(res, 400, { ok: false, error: 'Invalid role for invite' });
  const ttlSec = Number(body.ttlSec || 24 * 60 * 60);
  const invite = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(18).toString('hex'),
    role,
    createdBy: auth.state.user.username,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
    usedAt: null
  };
  const invites = readInvites();
  invites.push(invite);
  saveInvites(invites);
  recordAudit(req, 'admin.invite.create', { by: auth.state.user.username, role, inviteId: invite.id });
  json(res, 201, { ok: true, invite });
};

const handleAdminPayments = (req, res) => {
  const auth = requirePermission(req, res, 'payments:manage');
  if (!auth) return;
  const query = new URL(req.url, `http://${req.headers.host}`);
  const status = query.searchParams.get('status');
  const payments = readPayments().filter((p) => (status ? p.status === status : true));
  json(res, 200, { ok: true, total: payments.length, payments: payments.slice(-300).reverse() });
};

const handleAdminPaymentsExport = (_req, res) => {
  const payments = readPayments();
  const header = ['paymentId', 'status', 'amountRub', 'amountUsdt', 'createdBy', 'createdAt', 'updatedAt', 'txHash'];
  const rows = [header.join(';')];
  for (const p of payments) {
    rows.push([
      p.paymentId,
      p.status,
      p.amountRub,
      p.amountUsdt,
      p.createdBy?.username || '',
      p.createdAt || '',
      p.updatedAt || '',
      p.txHash || ''
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  }
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="payments.csv"', ...securityHeaders });
  res.end(`${rows.join('\n')}\n`);
};

const handleWebhookTelegramPaymentConfirmed = async (req, res) => {
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) return json(res, 403, { ok: false, error: 'Invalid webhook secret' });
  const body = await readBody(req);
  const paymentId = String(body.paymentId || '').trim();
  const txHash = String(body.txHash || '').trim();
  if (!paymentId || !txHash) return json(res, 400, { ok: false, error: 'paymentId and txHash required' });

  const fakeReq = { ...req, headers: { ...req.headers, 'x-csrf-token': 'system' } };
  const payments = readPayments();
  const payment = payments.find((p) => p.paymentId === paymentId);
  if (!payment) return json(res, 404, { ok: false, error: 'Payment not found' });

  const verify = await verifyTxHashWithProvider(txHash);
  if (!verify.verified) return json(res, 400, { ok: false, error: 'txHash verification failed' });

  payment.txHash = txHash;
  updatePaymentStatus(payment, 'confirmed', { txHash, source: 'telegram_webhook' });
  savePayments(payments);
  recordAudit(fakeReq, 'webhook.telegram.payment_confirmed', { paymentId, txHash });
  json(res, 200, { ok: true, paymentId, status: payment.status });
};

const handleReconcile = (req, res) => {
  const auth = requirePermission(req, res, 'payments:manage');
  if (!auth) return;
  const result = runReconcile();
  recordAudit(req, 'jobs.reconcile.run', { by: auth.state.user.username, ...result });
  json(res, 200, { ok: true, ...result });
};

const handleQueueReconcile = (req, res) => {
  const auth = requirePermission(req, res, 'payments:manage');
  if (!auth) return;
  jobQueue.push({ id: crypto.randomUUID(), type: 'reconcile', enqueuedAt: new Date().toISOString(), by: auth.state.user.username });
  json(res, 202, { ok: true, queued: true, size: jobQueue.length });
};

const handleHealth = (_req, res) => {
  json(res, 200, {
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    sessionCount: sessions.size,
    telemetryEnabled: TELEMETRY_ENABLED,
    retentionDays: RETENTION_DAYS,
    queueSize: jobQueue.length,
    infra: { postgresConfigured: Boolean(DATABASE_URL), redisConfigured: Boolean(REDIS_URL) }
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
    '# TYPE odkb_queue_processed_total counter',
    `odkb_queue_processed_total ${metrics.queueProcessed}`,
    '# TYPE odkb_sessions gauge',
    `odkb_sessions ${sessions.size}`
  ];
  res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', ...securityHeaders });
  res.end(`${lines.join('\n')}\n`);
};

const handleMePayments = (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const payments = readPayments().filter((p) => p.createdBy?.id === auth.state.user.id);
  json(res, 200, { ok: true, total: payments.length, payments: payments.slice(-100).reverse() });
};

const handleMeNotifications = (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const items = readNotifications().filter((n) => n.userId === auth.state.user.id).slice(-100).reverse();
  json(res, 200, { ok: true, notifications: items });
};

const handleKycUpdate = async (req, res) => {
  const auth = requireCsrf(req, res);
  if (!auth) return;
  const body = await readBody(req);
  const level = String(body.level || '').trim();
  if (!['basic', 'advanced'].includes(level)) return json(res, 400, { ok: false, error: 'Invalid kyc level' });
  const users = readUsers();
  const user = users.find((u) => u.id === auth.state.user.id);
  if (!user) return json(res, 404, { ok: false, error: 'User not found' });
  user.kycLevel = level;
  saveUsers(users);
  auth.state.user = toSessionPublicUser(user);
  recordAudit(req, 'user.kyc.update', { username: user.username, level });
  pushNotification(user.id, 'kyc_updated', `KYC обновлён: ${level}`, { level });
  json(res, 200, { ok: true, kycLevel: level, limits: getRoleLimits(user.role, user.kycLevel) });
};

const handleTicketsCreate = async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const body = await readBody(req);
  const subject = String(body.subject || '').trim().slice(0, 120);
  const message = String(body.message || '').trim().slice(0, 1000);
  if (!subject || !message) return json(res, 400, { ok: false, error: 'subject and message required' });
  const tickets = readTickets();
  const ticket = {
    id: crypto.randomUUID(),
    userId: auth.state.user.id,
    status: 'open',
    subject,
    messages: [{ by: auth.state.user.username, role: auth.state.user.role, text: message, at: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  tickets.push(ticket);
  saveTickets(tickets);
  recordAudit(req, 'ticket.create', { ticketId: ticket.id, by: auth.state.user.username });
  json(res, 201, { ok: true, ticket });
};

const handleTicketsList = (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const tickets = readTickets();
  const visible = auth.state.user.role === 'admin' ? tickets : tickets.filter((t) => t.userId === auth.state.user.id);
  json(res, 200, { ok: true, tickets: visible.slice(-200).reverse() });
};

const handleTicketsReply = async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const body = await readBody(req);
  const ticketId = String(body.ticketId || '').trim();
  const text = String(body.message || '').trim().slice(0, 1000);
  if (!ticketId || !text) return json(res, 400, { ok: false, error: 'ticketId and message required' });
  const tickets = readTickets();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) return json(res, 404, { ok: false, error: 'Ticket not found' });
  if (auth.state.user.role !== 'admin' && ticket.userId !== auth.state.user.id) return json(res, 403, { ok: false, error: 'Forbidden' });
  ticket.messages.push({ by: auth.state.user.username, role: auth.state.user.role, text, at: new Date().toISOString() });
  ticket.updatedAt = new Date().toISOString();
  saveTickets(tickets);
  recordAudit(req, 'ticket.reply', { ticketId, by: auth.state.user.username });
  json(res, 200, { ok: true, ticket });
};

const handlePolicy = (_req, res) => {
  json(res, 200, {
    ok: true,
    privacy: 'Мы собираем только необходимые продуктовые и технические данные для функционирования сервиса.',
    terms: 'Используя сервис, пользователь соглашается с правилами платежей, KYC и обработки данных.',
    compliance: {
      ru152fz: true,
      gdprMapping: true,
      dpaReady: true
    }
  });
};

const handleDataExport = (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const users = readUsers();
  const me = users.find((u) => u.id === auth.state.user.id);
  const payments = readPayments().filter((p) => p.createdBy?.id === auth.state.user.id);
  const tickets = readTickets().filter((t) => t.userId === auth.state.user.id);
  const notifications = readNotifications().filter((n) => n.userId === auth.state.user.id);
  json(res, 200, { ok: true, export: { user: me ? toSessionPublicUser(me) : null, payments, tickets, notifications } });
};

const handleDataDeletionRequest = async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const body = await readBody(req);
  const reason = String(body.reason || '').slice(0, 300);
  const dsr = readDsr();
  dsr.push({ id: crypto.randomUUID(), userId: auth.state.user.id, type: 'delete_request', reason, status: 'open', createdAt: new Date().toISOString() });
  saveDsr(dsr);
  recordAudit(req, 'dsr.delete.requested', { by: auth.state.user.username });
  json(res, 202, { ok: true, status: 'queued' });
};

const handleAdminChecklist = (req, res) => {
  const auth = requirePermission(req, res, 'users:manage');
  if (!auth) return;
  json(res, 200, {
    ok: true,
    checklist: [
      { id: 'consent_policy', title: 'Проверить consent и privacy policy', done: false },
      { id: 'kyc_limits', title: 'Проверить KYC лимиты ролей', done: false },
      { id: 'reconcile_daily', title: 'Запустить reconcile job', done: false },
      { id: 'backup', title: 'Проверить backup/restore тест', done: false }
    ]
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

const normalizePath = (req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/v1/')) {
    url.pathname = `/api/${url.pathname.slice('/api/v1/'.length)}`;
    return `${url.pathname}${url.search}`;
  }
  return `${url.pathname}${url.search}`;
};

const server = http.createServer(async (req, res) => {
  metrics.requests += 1;
  const route = normalizePath(req);
  req.url = route;

  try {
    if (req.method === 'GET' && route === '/api/health') return handleHealth(req, res);
    if (req.method === 'GET' && route === '/metrics') return handleMetrics(req, res);

    if (req.method === 'POST' && route === '/api/auth/register') return authService.register(req, res);
    if (req.method === 'POST' && route === '/api/auth/login') return authService.login(req, res);
    if (req.method === 'GET' && route === '/api/auth/session') return handleSession(req, res);
    if (req.method === 'POST' && route === '/api/auth/logout') return handleLogout(req, res);

    if (req.method === 'GET' && route === '/api/public/runtime') return handlePublicRuntime(req, res);
    if (req.method === 'GET' && route === '/api/user/consent') return handleGetConsent(req, res);
    if (req.method === 'POST' && route === '/api/user/consent') return handleSetConsent(req, res);

    if (req.method === 'POST' && route === '/api/payments/telegram-crypto/create') return paymentService.create(req, res);
    if (req.method === 'POST' && route === '/api/payments/confirm-onchain') return paymentService.confirmOnchain(req, res);
    if (req.method === 'POST' && route === '/api/jobs/reconcile') return handleReconcile(req, res);
    if (req.method === 'POST' && route === '/api/jobs/queue/reconcile') return handleQueueReconcile(req, res);

    if (req.method === 'POST' && route === '/api/telemetry/collect') return telemetryService.collect(req, res);
    if (req.method === 'GET' && route === '/api/telemetry/summary') return handleTelemetrySummary(req, res);

    if (req.method === 'GET' && route === '/api/admin/users') return handleAdminUsers(req, res);
    if (req.method === 'POST' && route === '/api/admin/users/role') return handleAdminRoleUpdate(req, res);
    if (req.method === 'POST' && route === '/api/admin/invites') return handleAdminInviteCreate(req, res);
    if (req.method === 'GET' && route.startsWith('/api/admin/payments/export')) return handleAdminPaymentsExport(req, res);
    if (req.method === 'GET' && route.startsWith('/api/admin/payments')) return handleAdminPayments(req, res);
    if (req.method === 'GET' && route === '/api/admin/telemetry') return handleAdminTelemetry(req, res);
    if (req.method === 'GET' && route === '/api/admin/analytics/anomalies') return handleAdminAnomalies(req, res);

    if (req.method === 'POST' && route === '/api/webhooks/telegram/payment-confirmed') return handleWebhookTelegramPaymentConfirmed(req, res);


    if (req.method === 'GET' && route === '/api/me/payments') return handleMePayments(req, res);
    if (req.method === 'GET' && route === '/api/me/notifications') return handleMeNotifications(req, res);
    if (req.method === 'POST' && route === '/api/me/kyc') return handleKycUpdate(req, res);

    if (req.method === 'POST' && route === '/api/tickets') return handleTicketsCreate(req, res);
    if (req.method === 'GET' && route === '/api/tickets') return handleTicketsList(req, res);
    if (req.method === 'POST' && route === '/api/tickets/reply') return handleTicketsReply(req, res);

    if (req.method === 'GET' && route === '/api/legal/policy') return handlePolicy(req, res);
    if (req.method === 'GET' && route === '/api/legal/data-export') return handleDataExport(req, res);
    if (req.method === 'POST' && route === '/api/legal/data-delete-request') return handleDataDeletionRequest(req, res);

    if (req.method === 'GET' && route === '/api/admin/checklist') return handleAdminChecklist(req, res);

    if (req.method === 'GET' && route === '/healthz') return handleHealth(req, res);
    if (req.method === 'GET' && route === '/readyz') return handleHealth(req, res);

    return serveStatic(req, res);
  } catch (error) {
    return json(res, 500, { ok: false, error: 'Internal server error', message: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
