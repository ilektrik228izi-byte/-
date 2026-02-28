# ОДКБ — MVP Platform (v1 API)

Текущая версия — это уже platform-level MVP с backend-first архитектурой и базой под масштабирование.

## Реализовано (по roadmap)

### 1) Архитектура и масштабирование
- API versioning: поддержка `/api/v1/...` (с backward-совместимостью `/api/...`).
- Подготовка к Postgres + Redis через env wiring и docker-compose.
- Background jobs queue (in-memory) + reconcile job endpoints.
- Webhooks подсистема: Telegram payment confirmation webhook.

### 2) Auth / Security / ACL
- Серверные сессии + CSRF header + SameSite cookies.
- Session TTL + cleanup.
- Rate-limit для auth/payments + brute-force защита по IP и username.
- RBAC/ACL (`member`/`analyst`/`admin`) + audit лог админских действий.
- Role elevation через одноразовые invite tokens (`/api/admin/invites`), а не общий статический код.
- Security headers (CSP, X-Frame-Options, Referrer-Policy, etc.).

### 3) Платежи и финконтур
- Payment state machine: `draft -> pending_chain -> confirmed/expired/refunded`.
- Idempotency keys на create payment.
- Rate фиксация RUB↔USDT при создании платежа.
- TTL для инвойсов + reconcile (истечение pending/draft).
- On-chain verification (provider abstraction + confirm endpoint).
- Admin payment APIs + CSV export endpoint.

### 4) Данные и аналитика
- Event catalog baseline: regex-валидация event + version + piiClass.
- Consent management API и UI (telemetry/marketing consent).
- Retention policy cleanup по `RETENTION_DAYS`.
- BI snapshot/funnels/anomalies endpoints для admin telemetry анализа.
- Базовый user scoring по истории confirmed/refunded/expired платежей.

### 5) Ops / Observability / CI/CD / Backups
- `docker-compose.yml`: app + postgres + redis + prometheus.
- `/metrics` в Prometheus формате + `ops/prometheus.yml`.
- GitHub Actions CI (`check` + `test`).
- Backup script и reconcile client script.

## Основные API (v1)

- Auth: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/session`, `/api/v1/auth/logout`
- Consent: `/api/v1/user/consent`
- Payments:
  - `/api/v1/payments/telegram-crypto/create`
  - `/api/v1/payments/confirm-onchain`
  - `/api/v1/jobs/reconcile`
  - `/api/v1/jobs/queue/reconcile`
- Admin:
  - `/api/v1/admin/users`
  - `/api/v1/admin/users/role`
  - `/api/v1/admin/invites`
  - `/api/v1/admin/payments`
  - `/api/v1/admin/payments/export`
  - `/api/v1/admin/telemetry`
  - `/api/v1/admin/analytics/anomalies`
- Telemetry: `/api/v1/telemetry/collect`, `/api/v1/telemetry/summary`
- Ops: `/api/v1/health`, `/metrics`
- Webhooks: `/api/v1/webhooks/telegram/payment-confirmed`

## Запуск

```bash
cp .env.example .env
node server.js
```

## Тестирование

```bash
npm run check
npm test
```
