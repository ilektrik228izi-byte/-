# ОДКБ — MVP с разделением demo/prod логики

В репозитории есть frontend + backend-слой с серверной авторизацией, ролями/ACL и crypto-only платежами.

## Что усилено в этом релизе

- Серверные сессии с TTL (`SESSION_TTL_SEC`) и периодической очисткой.
- CSRF-защита для state-changing endpoint’ов (logout / create-payment).
- Базовый rate-limit по IP для auth и платежных endpoint’ов.
- Security headers для API и статики.
- Audit trail (`data/audit.log.ndjson`) для auth/payment действий.
- `/api/health` и admin endpoint `/api/admin/users` (RBAC: `users:manage`).

## Архитектура (кратко)

- **Auth на backend**:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/logout`
- **Роли и ACL**:
  - `member`
  - `analyst` (`confidential:view`, `telemetry:view`)
  - `admin` (`confidential:view`, `telemetry:view`, `users:manage`, `payments:manage`)
- **Payments**:
  - `POST /api/payments/telegram-crypto/create` (только авторизованная сессия + CSRF).
- **Runtime config**:
  - `GET /api/public/runtime` возвращает безопасные публичные настройки для клиента.
- **Telemetry**:
  - `POST /api/telemetry/collect`
  - `GET /api/telemetry/summary` (только с правом `telemetry:view`).
- `GET /api/admin/users` (только с правом `users:manage`).
- `GET /api/health` (проверка состояния сервиса).

## Запуск

```bash
cp .env.example .env
node server.js
```

Открыть: <http://localhost:4173>

## Production рекомендации

1. Вынести users/sessions/payments/telemetry из файлов в Postgres + Redis.
2. Подключить reverse proxy + TLS.
3. Добавить централизованные логи, алерты и бэкапы.
4. Добавить CI с интеграционными тестами API.
5. Добавить публичную политику обработки персональных данных.

## Данные/хранилище

- `data/users.json` — пользователи (хеши PBKDF2).
- `data/payments.log.ndjson` — журнал заявок платежей.
- `data/telemetry.log.ndjson` — журнал телеметрии.
- `data/audit.log.ndjson` — аудит событий безопасности/операций.

## Важно

Не храните реальные секреты в git. Используйте только переменные окружения.


## Примечания по безопасности

- Username: только `A-Za-z0-9_`, длина 3..32.
- Password: минимум 8 символов.
- Для HTTPS в проде включите `COOKIE_SECURE=true`.

## Тестирование

- Быстрая проверка синтаксиса:
  - `npm run check`
- Интеграционные smoke-тесты API (auth/CSRF/RBAC/payments):
  - `npm test`
