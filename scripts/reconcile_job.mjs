const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const csrf = process.env.CSRF_TOKEN || '';
const cookie = process.env.COOKIE || '';

if (!csrf || !cookie) {
  console.error('Set CSRF_TOKEN and COOKIE env vars to run reconcile job.');
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/jobs/reconcile`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf,
    Cookie: cookie
  },
  body: JSON.stringify({})
});

const body = await res.json();
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
