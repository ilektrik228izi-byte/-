import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rmSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'data');
const serverPort = 4193;
const baseUrl = `http://127.0.0.1:${serverPort}`;

const waitForServer = (proc) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 8000);

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.includes('Server running at')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.trim()) {
        // keep stderr visible for debugging
        process.stderr.write(text);
      }
    });

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });

const startServer = async () => {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  for (const name of ['users.json', 'telemetry.log.ndjson', 'payments.log.ndjson', 'audit.log.ndjson']) {
    rmSync(path.join(dataDir, name), { force: true });
  }

  const proc = spawn('node', ['server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(serverPort),
      HOST: '127.0.0.1',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'change_me_admin_password'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await waitForServer(proc);
  return proc;
};

const stopServer = (proc) =>
  new Promise((resolve) => {
    proc.once('exit', () => resolve());
    proc.kill('SIGINT');
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
      resolve();
    }, 2000);
  });

let serverProc;

test.before(async () => {
  serverProc = await startServer();
});

test.after(async () => {
  await stopServer(serverProc);
  for (const name of ['users.json', 'telemetry.log.ndjson', 'payments.log.ndjson', 'audit.log.ndjson']) {
    rmSync(path.join(dataDir, name), { force: true });
  }
});

test('health endpoint works', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.uptimeSec, 'number');
});

test('admin login + csrf + protected endpoints', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'change_me_admin_password' })
  });

  assert.equal(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.equal(loginBody.ok, true);
  const csrfToken = loginBody.session.csrfToken;
  assert.ok(csrfToken);

  const cookie = loginRes.headers.get('set-cookie');
  assert.ok(cookie && cookie.includes('sid='));

  const usersRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Cookie: cookie }
  });
  assert.equal(usersRes.status, 200);
  const usersBody = await usersRes.json();
  assert.equal(usersBody.ok, true);
  assert.ok(Array.isArray(usersBody.users));

  const noCsrfPayment = await fetch(`${baseUrl}/api/payments/telegram-crypto/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie
    },
    body: JSON.stringify({ amount: 100, description: 'no-csrf' })
  });
  assert.equal(noCsrfPayment.status, 403);

  const withCsrfPayment = await fetch(`${baseUrl}/api/payments/telegram-crypto/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ amount: 100, description: 'with-csrf', idempotencyKey: 'initial-payment-12345' })
  });
  assert.equal(withCsrfPayment.status, 200);
  const paymentBody = await withCsrfPayment.json();
  assert.equal(paymentBody.ok, true);

  const idem = 'idem-key-123456';
  const p1 = await fetch(`${baseUrl}/api/payments/telegram-crypto/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ amount: 42, description: 'idem', idempotencyKey: idem })
  });
  const p1Body = await p1.json();
  assert.equal(p1.status, 200);

  const p2 = await fetch(`${baseUrl}/api/payments/telegram-crypto/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ amount: 42, description: 'idem', idempotencyKey: idem })
  });
  const p2Body = await p2.json();
  assert.equal(p2.status, 200);
  assert.equal(p2Body.paymentId, p1Body.paymentId);

  const consentOff = await fetch(`${baseUrl}/api/user/consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ telemetry: false, marketing: false })
  });
  assert.equal(consentOff.status, 200);

  const tele = await fetch(`${baseUrl}/api/telemetry/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ event: 'test_event' })
  });
  const teleBody = await tele.json();
  assert.equal(tele.status, 200);
  assert.equal(teleBody.skipped, 'consent_disabled');

  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'X-CSRF-Token': csrfToken
    }
  });
  assert.equal(logoutRes.status, 200);
});
