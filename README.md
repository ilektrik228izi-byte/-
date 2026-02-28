# ОДКБ — MVP с разделением demo/prod логики

В репозитории теперь есть frontend + backend-слой с нормальной серверной авторизацией, ролями и ACL.

## Что изменено по архитектуре

- **Auth вынесен на backend**:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/logout`
- **Роли и ACL на сервере**:
  - `member`
  - `analyst` (`confidential:view`, `telemetry:view`)
  - `admin` (`confidential:view`, `telemetry:view`, `users:manage`, `payments:manage`)
- **Payments на backend**:
  - `POST /api/payments/telegram-crypto/create` только для авторизованных пользователей.
- **Sensitive-настройки убраны из клиентского кода**:
  - бот/кошелёк берутся через `GET /api/public/runtime` из env backend.
- **DonationAlerts заморожен**: только Telegram + TON/USDT.

## Запуск

```bash
cp .env.example .env
node server.js
```

Открыть: <http://localhost:4173>

## Production рекомендации

1. Установить реальные `ADMIN_PASSWORD`, `ROLE_ELEVATION_CODE`, кошельки и токены через env/secret manager.
2. Включить reverse proxy + TLS.
3. Поставить persistent storage/DB вместо файлов.
4. Добавить rotation и retention policy для логов телеметрии.
5. Добавить публичную политику обработки персональных данных.

## Данные/хранилище

- `data/users.json` — пользователи (хеши паролей PBKDF2).
- `data/payments.log.ndjson` — журнал заявок платежей.
- `data/telemetry.log.ndjson` — журнал телеметрии.

## Важно

Не храните реальные секреты в git. Используйте только переменные окружения.
