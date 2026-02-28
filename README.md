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


## Что ещё реализовать (большой backlog для серьёзного проекта)

Ниже — идеи следующего масштаба, разбитые по направлениям.

### Product / UX
- Личный кабинет с timeline всех операций пользователя (платежи, KYC, обращения, уведомления).
- Конструктор тарифов/подписок с периодическими платежами и trial-периодами.
- Smart onboarding: чеклист пользователя + прогресс-бар до «полного доступа».
- Мультиязычность интерфейса (RU/EN) + локализация форматирования сумм/дат.
- Сценарии восстановления аккаунта (подтверждение устройства, fallback-контакты).

### Security / Compliance
- Refresh-token rotation + device/session management (список активных устройств).
- MFA (TOTP/WebAuthn), step-up auth для чувствительных действий.
- Risk engine для suspicious login/payment activity.
- WAF-friendly request signatures + stricter webhook signature policies.
- Полноценные DSR workflow states (open/in-review/approved/rejected/completed) + SLA.

### Payments / Finance
- Двусторонние webhooks по статусам платежей (created/confirmed/expired/refunded).
- Retry orchestration для неустойчивых внешних провайдеров и dead-letter queue.
- Возвраты/частичные возвраты с reason codes и контролем двойных refund.
- Ledger-модель (double-entry) и сверка ledger↔операции↔балансы.
- Поддержка нескольких сетей/активов с policy-маршрутизацией по комиссиям/риску.

### Data / Analytics / AI
- Data contract для всех событий telemetry (schema versioning + compatibility checks).
- ETL в аналитическое хранилище + витрины для BI.
- Event funnels/retention/cohort dashboards в admin UI.
- Алгоритм динамического user scoring (поведение, фрод-сигналы, chargeback-like события).
- Автоалерты по аномалиям (volume spikes, failure rates, geo anomalies).

### Reliability / SRE
- Миграция JSON persistence на Postgres + Redis adapters с транзакциями и блокировками.
- Circuit breakers/timeouts/retries для внешних интеграций.
- Health/readiness/liveness раздельно + dependency checks.
- Chaos testing для очереди/вебхуков/провайдеров.
- Runbooks и auto-remediation для типовых аварийных сценариев.

### DevEx / Platform
- OpenAPI spec + автогенерация клиентских SDK.
- Contract tests (consumer-driven) между frontend/backend и внешними сервисами.
- Feature flags + progressive rollout.
- Полноценная staging среда с seed-данными и synthetic monitoring.
- GitHub environments + protected deployments + release notes automation.

### Admin / Operations
- Расширенная админка: фильтры, bulk actions, audit diff view.
- Ролевые политики granular RBAC (permission matrix + deny rules).
- Очередь модерации тикетов с SLA таймерами и шаблонами ответов.
- Центр уведомлений для админов (ошибки интеграций, превышения лимитов, фрод-флаги).
- Отчёты по операционным метрикам: MTTR, queue latency, webhook success rate.

### Документация и процессы
- ADR (architecture decision records) по ключевым решениям.
- Security playbook (incident response, key rotation, access reviews).
- On-call handbook + escalation matrix.
- Чёткая roadmap-сетка: now/next/later с критериями готовности.
- Регулярный продуктово-технический RFC процесс для крупных фич.


## Cloudflare Workers: деплой и маршруты

Если в Cloudflare Build Logs вы видите ошибку:
`Could not detect a directory containing static files`,
значит Wrangler запускался без явной конфигурации проекта.

В этом репозитории это исправлено через:
- `wrangler.toml` (явная конфигурация проекта)
- `worker.js` (entrypoint Worker)
- `assets` binding для раздачи `index.html`, `app.js`, `styles.css` и других статических файлов

### Что и где будет доступно
- Основной домен Worker: `https://bank1.ilektrik-228-izi.workers.dev`
- Preview-URL: `https://<hash>-bank1.ilektrik-228-izi.workers.dev`

### Маршруты
- `/` и любые front-end маршруты → статические файлы (с SPA fallback на `index.html`)
- `/api/*` → `501 Not Implemented` в Worker-сборке (пояснение в JSON),
  потому что текущий backend (`server.js`) написан под Node HTTP runtime.

### Команды деплоя
```bash
# рекомендуемый вариант (фиксирует корень репозитория и config)
npm run deploy:worker

# эквивалент
bash scripts/deploy_worker.sh
```

Если вы деплоите через Cloudflare Workers Builds, укажите в настройках проекта:
- **Build command / Deploy command**: `npm run deploy:worker`
- **Root directory**: корень репозитория (где лежит `wrangler.toml`)

### Важно
Cloudflare Worker в текущей конфигурации используется как static/frontend hosting.
Backend API из `server.js` нужно деплоить отдельно в Node-среду (Docker/VM/Render/Fly/etc.)
и затем проксировать/подключать к фронтенду по публичному API-URL.


### Частая ошибка и её причина
Ошибка:
`Could not detect a directory containing static files (e.g. html, css and js)`

Обычно это значит, что `wrangler` стартовал **не из корня репозитория** или не увидел `wrangler.toml`.
Скрипт `scripts/deploy_worker.sh` принудительно переходит в корень проекта и запускает deploy с `--config`.
