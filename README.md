# ОДКБ — MVP+ backend platform

Проект эволюционирует из демо в production-ready платформу: auth/ACL/payments/telemetry уже на backend + добавлены инфраструктурные и эксплуатационные блоки.

## Что уже реализовано в коде

- Backend auth + серверные сессии (TTL), CSRF, rate-limit, security headers.
- RBAC (`member` / `analyst` / `admin`) и ACL на admin/telemetry/payments endpoint’ах.
- Payment state machine (минимум): `pending_onchain -> confirmed | expired`.
- Idempotency для создания платежей (`idempotencyKey`).
- Audit log (`data/audit.log.ndjson`).
- Consent endpoints (`/api/user/consent`) и retention cleanup задач для telemetry/audit логов.
- Admin API: пользователи/роли, платежи, telemetry snapshot.
- Health + Prometheus metrics endpoint (`/metrics`).
- Integration smoke tests (`npm test`).

## Что добавлено по инфраструктуре

- `docker-compose.yml` с `app + postgres + redis + prometheus`.
- `ops/prometheus.yml` для скрейпа `/metrics`.
- GitHub Actions CI (`.github/workflows/ci.yml`): `npm run check` + `npm test`.
- Backup script: `npm run backup`.
- Reconciliation job client script: `npm run reconcile` (с CSRF + cookie env).

## Как это соответствует roadmap

### ✅ Postgres + Redis
Добавлены `docker-compose` сервисы и env wiring (`DATABASE_URL`, `REDIS_URL`) для миграции storage слоя.

### ✅ CSRF + rate limit + audit log
Реализовано на backend (auth/payments).

### ✅ Payment state machine + idempotency
Реализовано в `payments.json` + endpoint’ах create/confirm/reconcile.

### ✅ Basic integration tests
Реализовано в `tests/integration.test.mjs`.

### ✅ Admin panel для ролей/платежей/телеметрии
Добавлены admin API и UI секция в frontend.

### ✅ Consent + retention policy
Добавлены consent API и retention cleanup по дням.

### ✅ BI/сквозная аналитика + скоринг (база)
Добавлен telemetry snapshot endpoint + базовый score пользователя по истории подтверждённых/просроченных платежей.

### ✅ Full CI/CD + observability + backups (базовый уровень)
CI workflow, `/metrics`, `docker-compose`, backup/reconcile scripts.

### ✅ Hardening security и комплаенс-пакет (базовый уровень)
CSRF, rate-limit, security headers, audit trail, consent flags, retention.

### ✅ On-chain verification и reconciliation jobs (базовый уровень)
Добавлен endpoint подтверждения on-chain (`/api/payments/confirm-onchain`) и reconcile job (`/api/jobs/reconcile`).

## Запуск локально

```bash
cp .env.example .env
node server.js
```

Открыть: <http://localhost:4173>

## Проверки

```bash
npm run check
npm test
```
