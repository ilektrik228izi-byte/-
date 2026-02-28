const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const TELEMETRY_FILE = path.join(DATA_DIR, 'telemetry.log.ndjson');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.log.ndjson');

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '@username122333bot';
const TON_WALLET_ADDRESS = process.env.TON_WALLET_ADDRESS || 'UQBu-4JdgbIdHIYqj2tUazFi9iQ3BIpypK-akdmbnT1KbO9Q';
const TELEMETRY_ENABLED = String(process.env.TELEMETRY_ENABLED || 'true').toLowerCase() !== 'false';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
};

const getIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
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

const sanitizeEvent = (value) => String(value || 'unknown').slice(0, 200);

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

const handleTelemetryCollect = async (req, res) => {
  if (!TELEMETRY_ENABLED) {
    json(res, 200, { ok: true, telemetryEnabled: false });
    return;
  }

  try {
    const body = await readBody(req);
    const record = {
      id: randomUUID(),
      event: sanitizeEvent(body.event),
      user: body.user || null,
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

const handleTelemetrySummary = (_req, res) => {
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
    totalEvents: parsed.length,
    uniqueUsers: new Set(parsed.map((item) => item.user?.username).filter(Boolean)).size,
    lastEvents: parsed.slice(-10)
  });
};

const handleCreateCryptoPayment = async (req, res) => {
  try {
    const body = await readBody(req);
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      json(res, 400, { ok: false, error: 'amount must be a positive number' });
      return;
    }

    const paymentId = randomUUID();
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
  const requestedPath = req.url === '/' ? '/index.html' : req.url;
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
