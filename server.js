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
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.log.ndjson');

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '@username122333bot';
const TON_WALLET_ADDRESS = process.env.TON_WALLET_ADDRESS || '';
const TELEMETRY_ENABLED = String(process.env.TELEMETRY_ENABLED || 'true').toLowerCase() !== 'false';
const ROLE_ELEVATION_CODE = process.env.ROLE_ELEVATION_CODE || '';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change_me_admin_password';

const ROLE_PERMISSIONS = {
  member: [],
  analyst: ['confidential:view', 'telemetry:view'],
  admin: ['confidential:view', 'telemetry:view', 'users:manage', 'payments:manage']
};

const sessions = new Map();

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

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

const createPasswordHash = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, encoded) => {
  const [salt, expectedHash] = String(encoded || '').split(':');
  if (!salt || !expectedHash) {
    return false;
  }
  const calculated = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const calculatedBuffer = Buffer.from(calculated, 'hex');
  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
};

const toSessionPublicUser = (user) => ({
  id: user.id,
  username: user.username,
  telegram: user.telegram || '',
  role: user.role,
  permissions: ROLE_PERMISSIONS[user.role] || []
});

const ensureAdminUser = () => {
  const users = readUsers();
  const exists = users.some((user) => user.username.toLowerCase() === ADMIN_USERNAME.toLowerCase());
  if (exists) {
    return;
  }

  users.push({
    id: crypto.randomUUID(),
    username: ADMIN_USERNAME,
    telegram: '',
    role: 'admin',
    passwordHash: createPasswordHash(ADMIN_PASSWORD),
    createdAt: new Date().toISOString()
  });

  saveUsers(users);
  console.log(`Bootstrap admin created: ${ADMIN_USERNAME}`);
};

ensureAdminUser();

const parseCookies = (req) => {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, item) => {
    const [key, ...rest] = item.trim().split('=');
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

const getIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
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
      if (!raw) {
        resolve({});
        return;
      }

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
    if (err) {
      console.error(`Failed to write ${filePath}:`, err.message);
    }
  });
};

const getSessionUser = (req) => {
  const sid = parseCookies(req).sid;
  if (!sid) {
    return null;
  }
  return sessions.get(sid) || null;
};

const requireAuth = (req, res) => {
  const user = getSessionUser(req);
  if (!user) {
    json(res, 401, { ok: false, error: 'Unauthorized' });
    return null;
  }
  return user;
};

const requirePermission = (req, res, permission) => {
  const user = requireAuth(req, res);
  if (!user) {
    return null;
  }

  const permissions = ROLE_PERMISSIONS[user.role] || [];
  if (!permissions.includes(permission)) {
    json(res, 403, { ok: false, error: 'Forbidden' });
    return null;
  }

  return user;
};

const createSession = (res, user) => {
  const sid = crypto.randomUUID();
  sessions.set(sid, user);
  const cookie = `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
  return { sid, cookie };
};

const handleRegister = async (req, res) => {
  try {
    const body = await readBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const telegram = String(body.telegram || '').trim().replace(/^@/, '');
    const accessCode = String(body.accessCode || '').trim();

    if (!username || username.length < 3) {
      json(res, 400, { ok: false, error: 'Username too short' });
      return;
    }
    if (!password || password.length < 6) {
      json(res, 400, { ok: false, error: 'Password too short' });
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
      passwordHash: createPasswordHash(password),
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    const sessionUser = toSessionPublicUser(user);
    const { cookie } = createSession(res, sessionUser);
    json(res, 201, { ok: true, session: sessionUser }, { 'Set-Cookie': cookie });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const handleLogin = async (req, res) => {
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

    const sessionUser = toSessionPublicUser(user);
    const { cookie } = createSession(res, sessionUser);
    json(res, 200, { ok: true, session: sessionUser }, { 'Set-Cookie': cookie });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
};

const handleSession = (req, res) => {
  const user = getSessionUser(req);
  json(res, 200, { ok: true, session: user });
};

const handleLogout = (req, res) => {
  const sid = parseCookies(req).sid;
  if (sid) {
    sessions.delete(sid);
  }

  json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' });
};

const handlePublicRuntime = (_req, res) => {
  json(res, 200, {
    ok: true,
    payments: {
      telegram_usdt: {
        recipient: TELEGRAM_BOT_USERNAME,
        wallet: TON_WALLET_ADDRESS
      }
    }
  });
};

const handleTelemetryCollect = async (req, res) => {
  if (!TELEMETRY_ENABLED) {
    json(res, 200, { ok: true, telemetryEnabled: false });
    return;
  }

  try {
    const body = await readBody(req);
    const sessionUser = getSessionUser(req);
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

const handleTelemetrySummary = (req, res) => {
  const user = requirePermission(req, res, 'telemetry:view');
  if (!user) {
    return;
  }

  if (!fs.existsSync(TELEMETRY_FILE)) {
    json(res, 200, { ok: true, totalEvents: 0, lastEvents: [] });
    return;
  }

  const lines = fs.readFileSync(TELEMETRY_FILE, 'utf-8').trim().split('\n').filter(Boolean);
  const parsed = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  json(res, 200, {
    ok: true,
    requestedBy: user.username,
    totalEvents: parsed.length,
    uniqueUsers: new Set(parsed.map((item) => item.user?.username).filter(Boolean)).size,
    lastEvents: parsed.slice(-10)
  });
};

const handleCreateCryptoPayment = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) {
    return;
  }

  try {
    const body = await readBody(req);
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      json(res, 400, { ok: false, error: 'amount must be a positive number' });
      return;
    }

    const paymentId = crypto.randomUUID();
    const description = String(body.description || 'Пополнение счёта').slice(0, 200);

    const payment = {
      paymentId,
      amount: amount.toFixed(2),
      method: 'telegram_usdt',
      network: 'TON / USDT (TON)',
      recipient: TELEGRAM_BOT_USERNAME,
      wallet: TON_WALLET_ADDRESS,
      description,
      metadata: body.metadata || null,
      createdBy: { id: user.id, username: user.username, role: user.role },
      server: collectServerContext(req)
    };

    appendNdjson(PAYMENTS_FILE, payment);

    const usernameWithoutAt = TELEGRAM_BOT_USERNAME.replace(/^@/, '');
    const deepLinkText = encodeURIComponent(`Оплата ${payment.amount} RUB | ${description} | ${paymentId}`);

    json(res, 200, {
      ok: true,
      paymentId,
      status: 'created',
      method: payment.method,
      recipient: TELEGRAM_BOT_USERNAME,
      wallet: TON_WALLET_ADDRESS,
      network: payment.network,
      deepLink: `https://t.me/${usernameWithoutAt}?start=${deepLinkText}`,
      instructions: 'Переведите USDT в сети TON на кошелёк и отправьте tx-hash оператору в Telegram.'
    });
  } catch (error) {
    json(res, 400, { ok: false, error: error.message });
  }
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
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, file) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
    res.end(file);
  });
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/auth/register') {
    handleRegister(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/login') {
    handleLogin(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/auth/session') {
    handleSession(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/logout') {
    handleLogout(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/public/runtime') {
    handlePublicRuntime(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/payments/telegram-crypto/create') {
    handleCreateCryptoPayment(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/telemetry/collect') {
    handleTelemetryCollect(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/telemetry/summary') {
    handleTelemetrySummary(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
