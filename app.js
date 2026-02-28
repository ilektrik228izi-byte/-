const STORAGE_KEYS = {
  users: "bank_users",
  session: "bank_session",
  leaderboard: "bank_leaderboard",
  theme: "bank_theme",
  coinGameBoard: "coin_game_board",
  behaviorStats: "behavior_stats"
};

const CONFIDENTIAL_ACCESS_CODE = "BANK_PRIVATE_2026";
const CONFIDENTIAL_ALLOWED_USERS = ["sick_x_people", "admin", "dev3xx"];

const COMPANY_TURNOVER = 61612.55;

const TELEGRAM_BOT_USERNAME = "@username122333bot";
const TON_WALLET_ADDRESS = "UQBu-4JdgbIdHIYqj2tUazFi9iQ3BIpypK-akdmbnT1KbO9Q";

const PAYMENTS_CONFIG = {
  telegram_usdt: {
    label: "Telegram-бот + крипта",
    recipient: TELEGRAM_BOT_USERNAME,
    endpoint: "/api/payments/telegram-crypto/create",
    network: "TON / USDT (TON)",
    wallet: TON_WALLET_ADDRESS
  }
};

const defaultBoard = {
  deposits: [
    { username: "Участник #1", amount: 245000, isPublic: false },
    { username: "Участник #2", amount: 188500, isPublic: false },
    { username: "Участник #3", amount: 145230, isPublic: false }
  ],
  loans: [
    { username: "Участник #4", amount: 540000, isPublic: false },
    { username: "Участник #5", amount: 332000, isPublic: false },
    { username: "Участник #6", amount: 210500, isPublic: false }
  ]
};

const loanRecords = [
  { borrower: "Гвоздев Гриша", telegram: "@dev3xx", amount: 400, percent: 25, mustReturn: 500, lentAt: "10.04.2025", dueAt: "13.04.2025", returned: true, earned: 100, note: "" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 30, percent: 100, mustReturn: 60, lentAt: "18.04.2025", dueAt: "19.04.2025", returned: true, earned: 30, note: "" },
  { borrower: "mrs new rock", telegram: "@sambukaya", amount: 300, percent: 33, mustReturn: 400, lentAt: "21.04.2025", dueAt: "30.04.2025", returned: true, earned: 100, note: "" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 300, percent: 17, mustReturn: 350, lentAt: "26.04.2025", dueAt: "30.04.2025", returned: true, earned: 50, note: "" },
  { borrower: "Казино (Толя Сударве)", telegram: "@SpokEar", amount: 800, percent: 172, mustReturn: 2174.49, lentAt: "26.04.2025", dueAt: "03.05.2025", returned: true, earned: 1374.49, note: "" },
  { borrower: "Анатолий Сударве", telegram: "@SpokEar", amount: 300, percent: 0, mustReturn: 300, lentAt: "02.05.2025", dueAt: "04.05.2025", returned: true, earned: 0, note: "" },
  { borrower: "Гвоздев Гриша", telegram: "@dev3xx", amount: 2200, percent: 36, mustReturn: 3000, lentAt: "24.04.2025", dueAt: "05.05.2025", returned: true, earned: 800, note: "" },
  { borrower: "Александр Новокшонов", telegram: "@strupik", amount: 700, percent: 43, mustReturn: 1000, lentAt: "26.04.2025", dueAt: "10.05.2025", returned: true, earned: 300, note: "" },
  { borrower: "Александр Новокшонов", telegram: "@strupik", amount: 200, percent: 150, mustReturn: 500, lentAt: "27.04.2025", dueAt: "10.05.2025", returned: true, earned: 300, note: "" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 200, percent: 50, mustReturn: 300, lentAt: "09.05.2025", dueAt: "13.05.2025", returned: true, earned: 100, note: "" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 200, percent: 50, mustReturn: 300, lentAt: "09.05.2025", dueAt: "15.05.2025", returned: true, earned: 100, note: "" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 400, percent: 50, mustReturn: 600, lentAt: "10.05.2025", dueAt: "15.05.2025", returned: true, earned: 200, note: "" },
  { borrower: "Анатолий Сударве", telegram: "@SpokEar", amount: 400, percent: 50, mustReturn: 599, lentAt: "14.05.2025", dueAt: "19.05.2025", returned: true, earned: 199, note: "Задержка до 25.05? В октябре вернул))" },
  { borrower: "Родион Иванов", telegram: "@CIKAT1LO", amount: 500, percent: 60, mustReturn: 800, lentAt: "11.05.2025", dueAt: "20.05.2025", returned: true, earned: 300, note: "Вернул только 500, проценты отказался возвращать" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 250, percent: 40, mustReturn: 350, lentAt: "19.05.2025", dueAt: "21.05.2025", returned: true, earned: 100, note: "Обманул на 100 рублей комиссии" },
  { borrower: "Дмитрий Разлуцкий", telegram: "@Cheblyatt", amount: 100, percent: null, mustReturn: 1700, lentAt: "21.05.2025", dueAt: "23.05.2025", returned: false, earned: 1600, note: "Старые долги: вернул 700, остался 1к" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 100, percent: 0, mustReturn: 100, lentAt: "21.05.2025", dueAt: "23.05.2025", returned: true, earned: 0, note: "Обман на комиссии" },
  { borrower: "Родион Иванов", telegram: "@CIKAT1LO", amount: 1000, percent: 20, mustReturn: 1200, lentAt: "27.05.2025", dueAt: "27.05.2025", returned: true, earned: 2000, note: "Вернул 2к, красавчик" },
  { borrower: "Гвоздев Гриша", telegram: "@dev3xx", amount: null, percent: null, mustReturn: 3000, lentAt: "27.05.2025", dueAt: "28.05.2025", returned: false, earned: 3000, note: "Тема с картами, не всё заплатил" },
  { borrower: "Дмитрий Разлуцкий", telegram: "@Cheblyatt", amount: 2000, percent: null, mustReturn: 2000, lentAt: "28.05.2025", dueAt: "29.05.2025", returned: true, earned: 2000, note: "За создание проекта" },
  { borrower: "Сергей Сахаров", telegram: "@hETnP8I2rXj3M7t", amount: 2000, percent: null, mustReturn: 2000, lentAt: "27.05.2025", dueAt: "30.05.2025", returned: true, earned: 2000, note: "За создание проекта" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 100, percent: 50, mustReturn: 150, lentAt: "21.05.2025", dueAt: "01.06.2025", returned: true, earned: 50, note: "Вернул раньше" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 400, percent: 50, mustReturn: 600, lentAt: "22.05.2025", dueAt: "01.06.2025", returned: true, earned: 200, note: "Вернул раньше" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 400, percent: 50, mustReturn: 600, lentAt: "25.05.2025", dueAt: "01.06.2025", returned: true, earned: 200, note: "Вернул раньше" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 130, percent: 54, mustReturn: 200, lentAt: "03.06.2025", dueAt: "07.06.2025", returned: true, earned: 70, note: "Если не вернет в срок — ЧС" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 100, percent: 50, mustReturn: 150, lentAt: "04.06.2025", dueAt: "07.06.2025", returned: true, earned: 50, note: "Вернул в тот же день" },
  { borrower: "Дмитрий Разлуцкий", telegram: "@Cheblyatt", amount: 300, percent: 17, mustReturn: 350, lentAt: "07.06.2025", dueAt: "07.06.2025", returned: false, earned: 50, note: "Потерялся" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 200, percent: 50, mustReturn: 300, lentAt: "05.06.2025", dueAt: "09.06.2025", returned: true, earned: 100, note: "" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 201.06, percent: 24, mustReturn: 250, lentAt: "09.06.2025", dueAt: "11.06.2025", returned: true, earned: 48.94, note: "Вернул 240" },
  { borrower: "Александр Новокшонов", telegram: "@strupik", amount: 5000, percent: 40, mustReturn: 7000, lentAt: "22.05.2025", dueAt: "15.06.2025", returned: true, earned: 2000, note: "Шутки про 6.5к, по факту закрыл" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 800, percent: 50, mustReturn: 1200, lentAt: "24.05.2025", dueAt: "15.06.2025", returned: true, earned: 400, note: "" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 240, percent: 50, mustReturn: 360, lentAt: "09.06.2025", dueAt: "15.06.2025", returned: true, earned: 120, note: "" },
  { borrower: "СерГей Романенко", telegram: "@G_r_a_y_2_2_8", amount: 3000, percent: 9, mustReturn: 3260, lentAt: "09.06.2025", dueAt: "15.06.2025", returned: true, earned: 260, note: "Вернул 1400 частями" },
  { borrower: "Элтун Гусейнов", telegram: "@Eltunchik_22", amount: 500, percent: 34, mustReturn: 668, lentAt: "27.02.2026", dueAt: "08.03.2026", returned: false, earned: 168, note: "Текущий долг" },
  { borrower: "Егор Молостов", telegram: "@BDSMshhik_terentyy", amount: 700, percent: 20, mustReturn: 840, lentAt: "10.02.2026", dueAt: "15.02.2026", returned: true, earned: 140, note: "80 за задержку" }
];

const themeToggle = document.getElementById("theme-toggle");
const authToggle = document.getElementById("auth-toggle");
const authDialog = document.getElementById("auth-dialog");
const authForm = document.getElementById("auth-form");
const closeAuth = document.getElementById("close-auth");
const switchMode = document.getElementById("switch-mode");
const authTitle = document.getElementById("auth-title");
const submitAuth = document.getElementById("submit-auth");
const userChip = document.getElementById("user-chip");
const statsForm = document.getElementById("stats-form");
const depositsList = document.getElementById("deposits-list");
const loansList = document.getElementById("loans-list");
const itemTemplate = document.getElementById("stat-item-template");
const loanBookBody = document.getElementById("loan-book-body");
const onlyUnknownCheckbox = document.getElementById("only-unknown");
const loanSearchInput = document.getElementById("loan-search");
const loanSort = document.getElementById("loan-sort");
const exportCsvButton = document.getElementById("export-csv");
const borrowerInsights = document.getElementById("borrower-insights");
const behaviorStats = document.getElementById("behavior-stats");
const publicTotalDealsNode = document.getElementById("public-total-deals");
const publicTurnoverNode = document.getElementById("public-turnover");
const publicExtraStatNode = document.getElementById("public-extra-stat");
const totalDealsNode = document.getElementById("total-deals");
const returnedDealsNode = document.getElementById("returned-deals");
const unknownDealsNode = document.getElementById("unknown-deals");
const totalProfitNode = document.getElementById("total-profit");
const turnoverNode = document.getElementById("turnover-kpi");
const x123Node = document.getElementById("x123-kpi");
const confidentialContent = document.getElementById("confidential-content");
const confidentialLock = document.getElementById("confidential-lock");
const paymentsStatus = document.getElementById("payments-status");
const paymentsActive = document.getElementById("payments-active");
const paymentsEndpoint = document.getElementById("payments-endpoint");
const paymentsRecipient = document.getElementById("payments-recipient");
const paymentsForm = document.getElementById("payments-form");
const paymentsMethod = document.getElementById("payments-method");
const paymentsCreateBtn = document.getElementById("payments-create-btn");
const paymentsCopyBtn = document.getElementById("payments-copy-btn");
const coinGameStart = document.getElementById("coin-game-start");
const coinGameTime = document.getElementById("coin-game-time");
const coinGameScore = document.getElementById("coin-game-score");
const coinGameArena = document.getElementById("coin-game-arena");
const coinGameLeaderboard = document.getElementById("coin-game-leaderboard");

let isRegisterMode = false;

const depositLeaderboardPhrases = [
  "Мечтает согреться вашими сбережениями и вырасти в надёжный актив.",
  "Хочет стать вашей финансовой подушкой и опорой на будущее.",
  "Ваши деньги будут здесь как дома — спокойно и с доходом.",
  "Тёплое местечко для холодных купюр и долгих планов.",
  "Растёт и радуется, когда вы пополняете счёт вовремя.",
  "Место для вашего капитала, который работает, а не спит.",
  "Копилочка ждёт тёплые монетки и дисциплину инвестора.",
  "Эта позиция любит тех, кто думает на месяцы вперёд.",
  "Здесь начинается уютный путь к большой финансовой цели.",
  "Ваш вклад может задать новый стандарт для всего топа."
];

const loanLeaderboardPhrases = [
  "Поможет воплотить мечты уже сегодня и не откладывать старт.",
  "Ждёт, чтобы поддержать вас в нужный момент без лишних слов.",
  "Ваш старт к новым вершинам — берите и действуйте чётко.",
  "Здесь рождаются возможности для тех, кто идёт в дело.",
  "Даёт крылья, чтобы взлететь и закрыть задачи в срок.",
  "Помогает не ждать, а делать, пока момент ещё горячий.",
  "Ваш персональный финансовый трамплин к следующему шагу.",
  "Эта строка для заёмщика, который держит слово и дедлайны.",
  "Нужен импульс в оборот? Тут место для быстрых решений.",
  "В топ попадают заёмщики, которые берут ответственно и возвращают вовремя."
];

let leaderboardRenderTick = 0;

const buildRotatedPhrases = (phrases, count, tick) => {
  if (!phrases.length || count <= 0) {
    return [];
  }

  const start = tick % phrases.length;
  const rotated = [...phrases.slice(start), ...phrases.slice(0, start)];
  return rotated.slice(0, count);
};

const trackBehavior = (eventName) => {
  const stats = readJSON(STORAGE_KEYS.behaviorStats, {});
  stats[eventName] = (stats[eventName] || 0) + 1;
  saveJSON(STORAGE_KEYS.behaviorStats, stats);
  sendTelemetry(eventName);
};

const renderBehaviorStats = () => {
  const stats = readJSON(STORAGE_KEYS.behaviorStats, {});
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 8);
  behaviorStats.innerHTML = "";
  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "Пока нет данных, соберите первые действия пользователей.";
    behaviorStats.append(li);
    return;
  }

  entries.forEach(([name, count]) => {
    const li = document.createElement("li");
    const title = document.createElement("span");
    const value = document.createElement("span");
    title.textContent = name;
    value.textContent = `${count}`;
    li.append(title, value);
    behaviorStats.append(li);
  });
};

const readJSON = (key, fallback) => {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) : fallback;
};

const saveJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const formatRub = (amount) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(amount);

const formatOptionalRub = (amount) => (typeof amount === "number" ? formatRub(amount) : "—");
const formatPercent = (value) => (typeof value === "number" ? `${value}%` : "—");
const safe = (value) => String(value ?? "");

const parseDate = (value) => {
  if (!value || !/^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
    return 0;
  }
  const [day, month, year] = value.split(".").map(Number);
  return new Date(year, month - 1, day).getTime();
};

const applyTheme = (theme) => {
  const dark = theme === "dark";
  document.body.classList.toggle("dark", dark);
  themeToggle.textContent = dark ? "☀️ Светлая тема" : "🌙 Тёмная тема";
};

const TELEMETRY_ENDPOINT = "/api/telemetry/collect";

const collectClientContext = () => ({
  path: location.pathname,
  url: location.href,
  referrer: document.referrer || null,
  language: navigator.language || null,
  languages: navigator.languages || [],
  platform: navigator.platform || null,
  userAgent: navigator.userAgent,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  screen: {
    width: window.screen?.width || null,
    height: window.screen?.height || null,
    pixelRatio: window.devicePixelRatio || 1
  },
  doNotTrack: navigator.doNotTrack || null,
  cookieEnabled: navigator.cookieEnabled
});

const sendTelemetry = (eventName, extra = null) => {
  if (!eventName || eventName.startsWith("phrase_show")) {
    return;
  }

  const session = getSession();
  const payload = {
    event: eventName,
    page: location.pathname,
    user: session ? { username: session.username, telegram: session.telegram || null } : null,
    client: collectClientContext(),
    extra
  };

  fetch(TELEMETRY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {});
};

const getPaymentMethodConfig = () => PAYMENTS_CONFIG[paymentsMethod.value] || PAYMENTS_CONFIG.telegram_usdt;

const buildPaymentPayload = (amount, description) => {
  const session = getSession();
  const method = paymentsMethod.value;
  const config = getPaymentMethodConfig();

  return {
    method,
    amount: Number(amount).toFixed(2),
    description,
    recipient: config.recipient,
    metadata: {
      user: session?.username || "guest",
      source: "bank-mvp"
    }
  };
};

const renderPaymentsPrep = () => {
  const config = getPaymentMethodConfig();
  const ready = Boolean(config.endpoint) || config.recipient.startsWith("@");

  paymentsActive.textContent = config.label;
  paymentsEndpoint.textContent = config.endpoint || "не задан (будет прямой перевод/ручная проверка)";
  const recipientLabel = config.wallet
    ? `${config.recipient} • wallet: ${config.wallet}`
    : config.recipient;
  paymentsRecipient.textContent = recipientLabel || "не задан";
  paymentsCreateBtn.disabled = false;
  paymentsStatus.textContent = ready
    ? "✅ Сценарий подготовлен. Можно выдавать клиенту шаги оплаты."
    : "⚠️ Заполните endpoint/recipient для выбранного сценария.";
};

const copyPaymentPayload = async () => {
  const amount = Number(new FormData(paymentsForm).get("amount"));
  const description = String(new FormData(paymentsForm).get("description") || "").trim();
  const payload = buildPaymentPayload(amount, description);
  const text = JSON.stringify(payload, null, 2);

  try {
    await navigator.clipboard.writeText(text);
    alert("Payload скопирован. Отправьте его оператору/боту.");
  } catch {
    alert("Не удалось скопировать автоматически. Payload выведен в консоль.");
    console.log("Payment payload:", text);
  }
};

const handlePaymentSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(paymentsForm);
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") || "").trim();
  const payload = buildPaymentPayload(amount, description);
  const config = getPaymentMethodConfig();

  sendTelemetry("payment_submit", { method: paymentsMethod.value, amount: payload.amount });

  if (config.endpoint) {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      alert("Ошибка API. Проверьте backend-слой и endpoint.");
      sendTelemetry("payment_submit_failed", { reason: "api_not_ok", status: response.status });
      return;
    }

    const data = await response.json();
    const link = data?.paymentUrl || data?.deepLink || data?.payment_url || data?.redirect_url || "";

    if (link) {
      paymentsStatus.textContent = `✅ Платёж создан: ${link}`;
      sendTelemetry("payment_submit_success", { paymentId: data.paymentId || null });
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }

    alert("Платеж создан, но ссылка не получена. Проверьте ответ API.");
    paymentsStatus.textContent = "⚠️ Платеж создан без ссылки. Нужна ручная проверка ответа API.";
    sendTelemetry("payment_submit_warning", { reason: "missing_link" });
    return;
  }

  const botName = config.recipient.replace(/^@/, "");
  const deepLink = `https://t.me/${botName}?start=pay_${encodeURIComponent(payload.amount)}`;
  const walletPart = config.wallet ? `
TON address: ${config.wallet}` : "";
  alert(`Отправьте клиенту: сумма ${payload.amount} (${config.network}), бот ${config.recipient}.
Deep link: ${deepLink}${walletPart}`);
};

let gameTimerId = null;
let gameSpawnId = null;
let gameSeconds = 20;
let gameScore = 0;

const getCoinGameBoard = () => readJSON(STORAGE_KEYS.coinGameBoard, []);

const saveCoinGameScore = (username, score) => {
  const board = getCoinGameBoard();
  board.push({ username, score, at: Date.now() });
  board.sort((a, b) => b.score - a.score || a.at - b.at);
  saveJSON(STORAGE_KEYS.coinGameBoard, board.slice(0, 10));
};

const renderCoinGameLeaderboard = () => {
  const board = getCoinGameBoard();
  coinGameLeaderboard.innerHTML = "";
  board.forEach((entry) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    const score = document.createElement("span");
    name.textContent = entry.username;
    score.textContent = `${entry.score} pts`;
    li.append(name, score);
    coinGameLeaderboard.append(li);
  });
};

const cleanupCoins = () => {
  coinGameArena.querySelectorAll(".coin").forEach((coin) => coin.remove());
};

const spawnCoin = () => {
  const coin = document.createElement("button");
  coin.type = "button";
  const isGold = Math.random() < 0.1;
  coin.className = `coin${isGold ? " gold" : ""}`;
  coin.textContent = isGold ? "🪙✨" : "🪙";
  coin.dataset.value = isGold ? "50" : "10";

  const width = coinGameArena.clientWidth - 44;
  const height = coinGameArena.clientHeight - 44;
  coin.style.left = `${Math.max(0, Math.floor(Math.random() * width))}px`;
  coin.style.top = `${Math.max(0, Math.floor(Math.random() * height))}px`;

  coin.addEventListener("click", () => {
    gameScore += Number(coin.dataset.value || 10);
    coinGameScore.textContent = String(gameScore);
    coin.classList.add("coin-pop");
    setTimeout(() => coin.remove(), 120);
  });

  coinGameArena.append(coin);
  setTimeout(() => coin.remove(), 1200);
};

const stopCoinGame = () => {
  if (gameTimerId) {
    clearInterval(gameTimerId);
    gameTimerId = null;
  }
  if (gameSpawnId) {
    clearInterval(gameSpawnId);
    gameSpawnId = null;
  }
  cleanupCoins();
  coinGameStart.disabled = false;

  const session = getSession();
  if (session?.username) {
    saveCoinGameScore(session.username, gameScore);
    renderCoinGameLeaderboard();
    renderBehaviorStats();
    sendTelemetry("coin_game_finish", { score: gameScore });
  }
};

const startCoinGame = () => {
  if (gameTimerId || !getSession()) {
    return;
  }

  gameSeconds = 20;
  gameScore = 0;
  coinGameTime.textContent = String(gameSeconds);
  coinGameScore.textContent = String(gameScore);
  coinGameStart.disabled = true;
  cleanupCoins();

  spawnCoin();
  gameSpawnId = setInterval(spawnCoin, 700);
  gameTimerId = setInterval(() => {
    gameSeconds -= 1;
    coinGameTime.textContent = String(gameSeconds);
    if (gameSeconds <= 0) {
      stopCoinGame();
    }
  }, 1000);
};

const hasTablePermission = (session) => {
  if (!session) {
    return false;
  }

  const normalized = session.username.trim().toLowerCase();
  const userAllowed = CONFIDENTIAL_ALLOWED_USERS.includes(normalized);
  return userAllowed && session.confidentialAccess === true;
};

const updateConfidentialUI = () => {
  const session = getSession();
  const allowed = hasTablePermission(session);

  confidentialContent.classList.toggle("hidden", !allowed);
  confidentialLock.classList.toggle("hidden", allowed);
};

const getUsers = () => readJSON(STORAGE_KEYS.users, []);
const getSession = () => readJSON(STORAGE_KEYS.session, null);

const getBoard = () => {
  const saved = readJSON(STORAGE_KEYS.leaderboard, null);
  if (saved) {
    return saved;
  }
  saveJSON(STORAGE_KEYS.leaderboard, defaultBoard);
  return defaultBoard;
};

const toSafeTag = (username) => (username.startsWith("@") ? username : `@${username}`);

const renderBoard = () => {
  leaderboardRenderTick += 1;
  const board = getBoard();
  const renderList = (items, node, phrases, boardType) => {
    node.innerHTML = "";
    const sorted = [...items].sort((a, b) => b.amount - a.amount).slice(0, 10);
    const dynamicPhrases = buildRotatedPhrases(phrases, sorted.length, leaderboardRenderTick);
    sorted.forEach((entry, index) => {
      const clone = itemTemplate.content.cloneNode(true);
      const nameNode = clone.querySelector(".name");
      const amountNode = clone.querySelector(".amount");
      const label = entry.isPublic ? entry.username : `Участник #${index + 1}`;
      const phrase = dynamicPhrases[index] || phrases[index % phrases.length] || "Здесь может быть ваша история.";
      nameNode.textContent = label;
      amountNode.textContent = phrase;
      amountNode.title = "Нажми, если откликается";
      amountNode.style.cursor = "pointer";
      amountNode.addEventListener("click", () => {
        trackBehavior(`phrase_click:${boardType}:${phrase}`);
        renderBehaviorStats();
      });
      trackBehavior(`phrase_show:${boardType}:${phrase}`);
      node.append(clone);
    });
  };

  renderList(board.deposits, depositsList, depositLeaderboardPhrases, "deposits");
  renderList(board.loans, loansList, loanLeaderboardPhrases, "loans");
};

const getFilteredLoanRecords = () => {
  const search = loanSearchInput.value.trim().toLowerCase();
  const onlyUnknown = onlyUnknownCheckbox.checked;
  const sortBy = loanSort.value;

  const filtered = loanRecords.filter((row) => {
    if (onlyUnknown && row.returned) {
      return false;
    }

    if (!search) {
      return true;
    }

    return `${row.borrower} ${row.telegram} ${row.note}`.toLowerCase().includes(search);
  });

  const sorted = [...filtered];
  if (sortBy === "profit_desc") {
    sorted.sort((a, b) => (b.earned || 0) - (a.earned || 0));
  } else if (sortBy === "amount_desc") {
    sorted.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  } else if (sortBy === "dueAt_asc") {
    sorted.sort((a, b) => parseDate(a.dueAt) - parseDate(b.dueAt));
  } else {
    sorted.sort((a, b) => parseDate(b.lentAt) - parseDate(a.lentAt));
  }

  return sorted;
};

const renderPublicTrustStats = () => {
  publicTotalDealsNode.textContent = `${loanRecords.length} человек`;
  const roundedTurnover = Math.round(COMPANY_TURNOVER);
  publicTurnoverNode.textContent = `${new Intl.NumberFormat("ru-RU").format(roundedTurnover)} ₽`;

  const avgDeal = loanRecords.length ? COMPANY_TURNOVER / loanRecords.length : 0;
  const totalProfit = loanRecords.reduce((sum, row) => sum + (typeof row.earned === "number" ? row.earned : 0), 0);
  publicExtraStatNode.textContent = `Средняя сделка: ${formatRub(avgDeal)} • Заработано для вас: ${formatRub(totalProfit)}`;
};

const renderLoanBookStats = () => {
  const totalDeals = loanRecords.length;
  const returnedDeals = loanRecords.filter((row) => row.returned).length;
  const unknownDeals = totalDeals - returnedDeals;
  const totalProfit = loanRecords.reduce((sum, row) => sum + (typeof row.earned === "number" ? row.earned : 0), 0);
  const x123 = COMPANY_TURNOVER ? (totalProfit / COMPANY_TURNOVER) * 100 : 0;

  totalDealsNode.textContent = String(totalDeals);
  returnedDealsNode.textContent = String(returnedDeals);
  unknownDealsNode.textContent = String(unknownDeals);
  totalProfitNode.textContent = formatRub(totalProfit);
  turnoverNode.textContent = formatRub(COMPANY_TURNOVER);
  x123Node.textContent = `${x123.toFixed(5)}%`;
};

const renderBorrowerInsights = () => {
  const totals = new Map();
  loanRecords.forEach((row) => {
    const key = `${row.borrower} (${row.telegram})`;
    const current = totals.get(key) || 0;
    totals.set(key, current + (row.earned || 0));
  });

  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  borrowerInsights.innerHTML = "";
  top.forEach(([name, total]) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const amount = document.createElement("span");
    label.textContent = name;
    amount.textContent = formatRub(total);
    li.append(label, amount);
    borrowerInsights.append(li);
  });
};

const exportLoanTableToCsv = () => {
  const rows = getFilteredLoanRecords();
  const header = [
    "Заниматель",
    "Сумма займа",
    "Процент займа",
    "Сколько должен вернуть",
    "Занял",
    "Должен вернуть",
    "Вернул",
    "Сколько я заработал",
    "Итого / заметки"
  ];

  const csvRows = [header.join(";")];
  rows.forEach((row) => {
    const data = [
      `${row.borrower} (${row.telegram})`,
      row.amount ?? "",
      row.percent ?? "",
      row.mustReturn ?? "",
      row.lentAt ?? "",
      row.dueAt ?? "",
      row.returned ? "+" : "?",
      row.earned ?? "",
      row.note ?? ""
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`);

    csvRows.push(data.join(";"));
  });

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "loan-ledger.csv";
  link.click();
  URL.revokeObjectURL(url);
};

const renderLoanBookTable = () => {
  const rows = getFilteredLoanRecords();
  loanBookBody.innerHTML = "";

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    const borrowerCell = document.createElement("td");
    borrowerCell.textContent = `${safe(row.borrower)} (${safe(row.telegram)})`;

    const amountCell = document.createElement("td");
    amountCell.textContent = formatOptionalRub(row.amount);

    const percentCell = document.createElement("td");
    percentCell.textContent = formatPercent(row.percent);

    const mustReturnCell = document.createElement("td");
    mustReturnCell.textContent = formatOptionalRub(row.mustReturn);

    const lentAtCell = document.createElement("td");
    lentAtCell.textContent = safe(row.lentAt);

    const dueAtCell = document.createElement("td");
    dueAtCell.textContent = safe(row.dueAt);

    const returnedCell = document.createElement("td");
    returnedCell.textContent = row.returned ? "+" : "?";

    const earnedCell = document.createElement("td");
    earnedCell.textContent = formatOptionalRub(row.earned);

    const noteCell = document.createElement("td");
    noteCell.textContent = row.note || "—";

    tr.append(
      borrowerCell,
      amountCell,
      percentCell,
      mustReturnCell,
      lentAtCell,
      dueAtCell,
      returnedCell,
      earnedCell,
      noteCell
    );

    loanBookBody.append(tr);
  });
};

const updateSessionUI = () => {
  const user = getSession();
  if (!user) {
    userChip.classList.add("hidden");
    userChip.textContent = "";
    statsForm.classList.add("hidden");
    authToggle.textContent = "Войти / Зарегистрироваться";
    coinGameStart.disabled = true;
    updateConfidentialUI();
    return;
  }

  const telegramPart = user.telegram ? ` • Telegram: ${toSafeTag(user.telegram)}` : "";
  const securePart = user.confidentialAccess ? " • Доступ к таблице: да" : "";
  userChip.textContent = `${user.username}${telegramPart}${securePart}`;
  userChip.classList.remove("hidden");
  statsForm.classList.remove("hidden");
  authToggle.textContent = "Сменить аккаунт";
  coinGameStart.disabled = false;
  updateConfidentialUI();
};

const setAuthMode = (registerMode) => {
  isRegisterMode = registerMode;
  authTitle.textContent = registerMode ? "Регистрация" : "Авторизация";
  submitAuth.textContent = registerMode ? "Создать аккаунт" : "Войти";
  switchMode.textContent = registerMode ? "Перейти ко входу" : "Перейти к регистрации";
};

switchMode.addEventListener("click", () => setAuthMode(!isRegisterMode));
authToggle.addEventListener("click", () => {
  trackBehavior("open_auth_dialog");
  renderBehaviorStats();
  authDialog.showModal();
});
closeAuth.addEventListener("click", () => authDialog.close());
onlyUnknownCheckbox.addEventListener("change", renderLoanBookTable);
loanSearchInput.addEventListener("input", () => {
  trackBehavior("loan_search_input");
  renderLoanBookTable();
  renderBehaviorStats();
});
loanSort.addEventListener("change", () => {
  trackBehavior("loan_sort_change");
  renderLoanBookTable();
  renderBehaviorStats();
});
exportCsvButton.addEventListener("click", () => {
  trackBehavior("export_csv");
  renderBehaviorStats();
  exportLoanTableToCsv();
});
themeToggle.addEventListener("click", () => {
  const next = document.body.classList.contains("dark") ? "light" : "dark";
  saveJSON(STORAGE_KEYS.theme, next);
  applyTheme(next);
});
paymentsForm.addEventListener("submit", handlePaymentSubmit);
paymentsCopyBtn.addEventListener("click", copyPaymentPayload);
paymentsMethod.addEventListener("change", renderPaymentsPrep);
coinGameStart.addEventListener("click", () => {
  trackBehavior("coin_game_start");
  renderBehaviorStats();
  startCoinGame();
});

const grantWelcomeBonus = (username) => {
  const board = getBoard();
  board.deposits = board.deposits.filter((entry) => entry.username !== username);
  board.deposits.push({ username, amount: 100, isPublic: false });
  saveJSON(STORAGE_KEYS.leaderboard, board);
  trackBehavior("welcome_bonus_granted");
  renderBoard();
  renderBehaviorStats();
};

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const telegramRaw = String(formData.get("telegram") || "").trim();
  const telegram = telegramRaw.replace(/^@/, "");
  const accessCode = String(formData.get("accessCode") || "").trim();

  if (!username || !password) {
    return;
  }

  const users = getUsers();

  if (isRegisterMode) {
    const existing = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      alert("Пользователь с таким логином уже существует.");
      return;
    }

    const confidentialAccess = accessCode === CONFIDENTIAL_ACCESS_CODE;
    users.push({ username, password, telegram, confidentialAccess });
    saveJSON(STORAGE_KEYS.users, users);
    saveJSON(STORAGE_KEYS.session, { username, telegram, confidentialAccess });
    trackBehavior("register_success");
    grantWelcomeBonus(username);
    if (!confidentialAccess) {
      alert(`🎁 ${username}, вам начислен приветственный бонус 100 ₽ во вклад! Аккаунт создан, доступ к конфиденциальной таблице не выдан.`);
    } else {
      alert(`🎁 ${username}, вам начислен приветственный бонус 100 ₽ во вклад! Доступ к конфиденциальной таблице открыт.`);
    }
  } else {
    const matched = users.find((u) => u.username === username && u.password === password);
    if (!matched) {
      alert("Неверный логин или пароль.");
      return;
    }

    const updatedTelegram = telegram || matched.telegram;
    if (updatedTelegram !== matched.telegram) {
      matched.telegram = updatedTelegram;
    }

    if (accessCode === CONFIDENTIAL_ACCESS_CODE) {
      matched.confidentialAccess = true;
    }

    saveJSON(STORAGE_KEYS.users, users);
    trackBehavior("login_success");
    renderBehaviorStats();
    saveJSON(STORAGE_KEYS.session, {
      username: matched.username,
      telegram: matched.telegram,
      confidentialAccess: Boolean(matched.confidentialAccess)
    });
  }

  authDialog.close();
  authForm.reset();
  updateSessionUI();
});

statsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const session = getSession();
  if (!session) {
    return;
  }

  const formData = new FormData(statsForm);
  const deposit = Number(formData.get("deposit"));
  const loan = Number(formData.get("loan"));
  const shareName = Boolean(formData.get("shareName"));

  if (Number.isNaN(deposit) || Number.isNaN(loan)) {
    return;
  }

  const board = getBoard();
  const clearOld = (list) => list.filter((entry) => entry.username !== session.username);

  board.deposits = clearOld(board.deposits);
  board.loans = clearOld(board.loans);

  board.deposits.push({ username: session.username, amount: deposit, isPublic: shareName });
  board.loans.push({ username: session.username, amount: loan, isPublic: shareName });

  trackBehavior("leaderboard_submit");
  renderBehaviorStats();
  saveJSON(STORAGE_KEYS.leaderboard, board);
  renderBoard();
  statsForm.reset();
});

const storedTheme = readJSON(STORAGE_KEYS.theme, "light");
applyTheme(storedTheme);

setAuthMode(false);
updateSessionUI();
sendTelemetry("page_open");
renderBoard();
renderPublicTrustStats();
renderLoanBookStats();
renderLoanBookTable();
updateConfidentialUI();
renderPaymentsPrep();
renderCoinGameLeaderboard();
renderBehaviorStats();
