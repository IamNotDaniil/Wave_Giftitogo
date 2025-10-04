const express = require('express');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, getUserBalance, updateUserBalance, getUserStats, getAllItems, client } = require('./database');
const app = express();

app.use(express.static('public'));
app.use(express.json());

// Initialize database on startup
initializeDatabase()
  .then(() => syncItemsFromDatabase())
  .catch(error => {
    console.error('Database initialization error:', error);
  });

// Telegram Bot Configuration
const BOT_TOKEN = process.env.BOT_TOKEN || '8417659328:AAFNp89cN4LJWTQ121wtoaR-P0vSh43DYYA'; // Замените на ваш реальный токен

// Handle Telegram webhook
// Handle Telegram webhook
app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  const update = req.body;

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || '';

    // --- /start ---
    if (text === '/start') {
      const welcomeMessage = `🎁 <b>Добро пожаловать в MetaGift!</b>

Покупайте и дарите уникальные подарки в Telegram!

🌟 <b>Что вас ждет:</b>
• Эксклюзивные цифровые подарки
• Передача подарков друзьям
• Пополнение баланса Stars
• Реферальная программа

Нажмите кнопку ниже чтобы открыть магазин! 👇`;

      const keyboard = {
        inline_keyboard: [[
          {
            text: "🛍️ Открыть магазин",
            web_app: { url: "https://wave-gift-itog.onrender.com" }
          }
        ]]
      };

      const photoUrl = "https://wave-gift-itog.onrender.com/assets/welcom.png";
      await sendTelegramPhotoWithKeyboard(chatId, photoUrl, welcomeMessage, keyboard);
    }

    // --- /stars ---
    if (text === '/stars') {
      const starsMessage = `⭐ <b>Telegram Stars</b>

Используйте Telegram Stars для покупки подарков!

💰 <b>Преимущества Stars:</b>
• Быстрая и безопасная оплата
• Мгновенное зачисление на баланс
• Покупка подарков одним кликом

Откройте магазин чтобы пополнить баланс Stars! 👇`;

      const keyboard = {
        inline_keyboard: [[
          {
            text: "⭐ Открыть магазин Stars",
            web_app: { url: "https://wave-gift-itog.onrender.com" }
          }
        ]]
      };

      const photoUrl = "https://wave-gift-itog.onrender.com/assets/welcom.png";
      await sendTelegramPhotoWithKeyboard(chatId, photoUrl, starsMessage, keyboard);
    }
  }

  res.status(200).send('OK');
});



// === Вынеси функцию отдельно (рядом с sendTelegramMessageWithKeyboard) ===
async function sendTelegramPhotoWithKeyboard(chatId, photoUrl, caption, keyboard, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping photo send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: parse_mode,
        reply_markup: keyboard
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Photo with keyboard sent successfully to chat ${chatId}`);
      return true;
    } else {
      console.log(`❌ Failed to send photo with keyboard to chat ${chatId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending photo with keyboard to chat ${chatId}:`, error);
    return false;
  }
}

// Currency rates and payment configuration
const CURRENCY_RATES = {
  TON_TO_STARS: 100, // 1 TON = 100 Stars
  TON_TO_RUBLE: 300, // 1 TON = 300 рублей (примерный курс)
  STARS_TO_RUBLE: 3   // 1 Star = 3 рубля
};

const PAYMENT_METHODS = {
  STARS: {
    name: 'Telegram Stars',
    icon: 'https://i.postimg.cc/3N3f5zhH/IMG-1243.png',
    contact: '@WaveGift_support'
  },
  YOOMONEY: {
    name: 'ЮMoney',
    icon: 'https://thumb.tildacdn.com/tild6365-6562-4437-a465-306531386233/-/format/webp/4.png',
    wallet: '4100118542839036'
  },
  TON: {
    name: 'TON Wallet',
    icon: 'https://ton.org/download/ton_symbol.png',
    wallet: 'UQDy5hhPvhwcNY9g-lP-nkjdmx4rAVZGFEnhOKzdF-JcIiDW'
  }
};

// Convert TON price to other currencies
function convertPrice(tonPrice, targetCurrency) {
  switch (targetCurrency) {
    case 'STARS':
      return Math.ceil(tonPrice * CURRENCY_RATES.TON_TO_STARS);
    case 'YOOMONEY':
      return Math.ceil(tonPrice * CURRENCY_RATES.TON_TO_RUBLE);
    case 'TON':
      return tonPrice;
    default:
      return tonPrice;
  }
}

// Function to send message via Telegram Bot API
async function sendTelegramMessage(userId, message, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: parse_mode
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message sent successfully to user ${userId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message to user ${userId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message to user ${userId}:`, error);
    return false;
  }
}

// Function to send message with inline keyboard
async function sendTelegramMessageWithKeyboard(chatId, message, keyboard, parse_mode = 'HTML') {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.log('Bot token not configured, skipping message send');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parse_mode,
        reply_markup: keyboard
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Message with keyboard sent successfully to chat ${chatId}`);
      return true;
    } else {
      console.log(`❌ Failed to send message with keyboard to chat ${chatId}:`, result.description);
      return false;
    }
  } catch (error) {
    console.error(`Error sending message with keyboard to chat ${chatId}:`, error);
    return false;
  }
}

// Data file paths
const DATA_FILE = path.join(__dirname, 'data.json');
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
const INVENTORY_FILE = path.join(__dirname, 'inventory.json');
const USER_STATS_FILE = path.join(__dirname, 'user-stats.json');
const REFERRALS_FILE = path.join(__dirname, 'referrals.json');
const PAYMENT_REQUESTS_FILE = path.join(__dirname, 'payment-requests.json');
const USER_BALANCE_FILE = path.join(__dirname, 'user-balance.json');

// Load data from files or use defaults
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading data file, using defaults');
    }

    return [
  {
    id: 9181,
    name: "Pink Flamingo x1 Co...",
    image: "https://i.postimg.cc/Y02HBW8v/IMG-1194.png",
    price: 10,
    quantity: "x1",
    stock: 3,
    tag: "NEW",
    tagColor: "new"
  },
  {
    id: 9180,
    name: "Sand Castle x1",
    image: "🏰",
    price: 3.3,
    quantity: "x1",
    stock: 5,
    tag: "HOT",
    tagColor: "hot"
  },
  {
    id: 9179,
    name: "Sand Castle x1",
    image: "🏰",
    price: 3.68,
    quantity: "x1",
    stock: 2,
    tag: "",
    tagColor: "new"
  },
  {
    id: 9178,
    name: "Eagle x2",
    image: "🦅",
    price: 150,
    quantity: "x2",
    stock: 1,
    tag: "RARE",
    tagColor: "rare"
  },
  {
    id: 7549,
    name: "Case x1",
    image: "💼",
    price: 39,
    quantity: "x1",
    stock: 4,
    tag: "TOP",
    tagColor: "top"
  },
  {
    id: 7539,
    name: "Case x1",
    image: "💼",
    price: 41,
    quantity: "x1",
    stock: 2,
    tag: "SALE",
    tagColor: "sale"
  }
];
}

function loadActivityData() {
    try {
        if (fs.existsSync(ACTIVITY_FILE)) {
            const data = fs.readFileSync(ACTIVITY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading activity file');
    }
    return [];
}

function loadInventoryData() {
    try {
        if (fs.existsSync(INVENTORY_FILE)) {
            const data = fs.readFileSync(INVENTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading inventory file');
    }
    return [];
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving data:', error);
    }
}

function saveActivityData(data) {
    try {
        fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving activity:', error);
    }
}

function saveInventoryData(data) {
    try {
        fs.writeFileSync(INVENTORY_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving inventory:', error);
    }
}

function loadUserStatsData() {
    try {
        if (fs.existsSync(USER_STATS_FILE)) {
            const data = fs.readFileSync(USER_STATS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading user stats file');
    }
    return {};
}

function saveUserStatsData(data) {
    try {
        fs.writeFileSync(USER_STATS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving user stats:', error);
    }
}

function loadReferralsData() {
    try {
        if (fs.existsSync(REFERRALS_FILE)) {
            const data = fs.readFileSync(REFERRALS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading referrals file');
    }
    return {};
}

function saveReferralsData(data) {
    try {
        fs.writeFileSync(REFERRALS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving referrals:', error);
    }
}

function loadPaymentRequestsData() {
    try {
        if (fs.existsSync(PAYMENT_REQUESTS_FILE)) {
            const data = fs.readFileSync(PAYMENT_REQUESTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading payment requests file');
    }
    return [];
}

function savePaymentRequestsData(data) {
    try {
        fs.writeFileSync(PAYMENT_REQUESTS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving payment requests:', error);
    }
}

function loadUserBalanceData() {
    try {
        if (fs.existsSync(USER_BALANCE_FILE)) {
            const data = fs.readFileSync(USER_BALANCE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('Error loading user balance file');
    }
    return {};
}

function saveUserBalanceData(data) {
    try {
        fs.writeFileSync(USER_BALANCE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.log('Error saving user balance:', error);
    }
}

// Load initial data
let nftItems = loadData().map(item => ensurePriceStructure(item));
let activityItems = loadActivityData();
let inventoryItems = loadInventoryData();
let userStatsData = loadUserStatsData();
let referralsData = loadReferralsData();
let paymentRequestsData = loadPaymentRequestsData();
let userBalanceData = loadUserBalanceData();

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function ensurePriceStructure(item) {
  const tonPrice = toNumber(item.price);
  const starsPrice = item.prices?.STARS !== undefined ? toNumber(item.prices.STARS) : Math.ceil(tonPrice * CURRENCY_RATES.TON_TO_STARS);
  const rubPrice = item.prices?.RUB !== undefined ? toNumber(item.prices.RUB) : Math.ceil(tonPrice * CURRENCY_RATES.TON_TO_RUBLE);

  item.price = tonPrice;
  item.prices = {
    TON: toNumber(item.prices?.TON, tonPrice),
    STARS: starsPrice,
    RUB: rubPrice
  };

  if (item.stock === undefined || item.stock === null) {
    item.stock = 0;
  }

  item.quantity = item.quantity || 'x1';
  item.tagColor = item.tagColor || item.tag_color || 'new';
  item.statusColor = item.statusColor || item.status_color || 'rare';

  return item;
}

function mapDbRowToItem(row) {
  if (!row) {
    return null;
  }

  const item = {
    id: row.id,
    name: row.name,
    image: row.image,
    description: row.description,
    price: toNumber(row.price_ton),
    prices: {
      TON: toNumber(row.price_ton),
      STARS: toNumber(row.price_stars),
      RUB: toNumber(row.price_rub)
    },
    quantity: row.quantity || 'x1',
    stock: row.stock ?? 0,
    tag: row.tag || '',
    tagColor: row.tag_color || 'new',
    status: row.status || 'Редкий',
    statusColor: row.status_color || 'rare'
  };

  return ensurePriceStructure(item);
}

async function getItemFromCacheOrDb(itemId) {
  let itemIndex = nftItems.findIndex(item => item.id === itemId);

  if (itemIndex !== -1) {
    const cachedItem = ensurePriceStructure(nftItems[itemIndex]);
    nftItems[itemIndex] = cachedItem;
    return cachedItem;
  }

  const dataItems = loadData();
  const fileItemIndex = dataItems.findIndex(item => item.id === itemId);
  if (fileItemIndex !== -1) {
    const fileItem = ensurePriceStructure(dataItems[fileItemIndex]);
    nftItems.push(fileItem);
    saveData(nftItems);
    return fileItem;
  }

  try {
    const result = await client.query('SELECT * FROM items WHERE id = $1 LIMIT 1', [itemId]);
    if (result.rows.length > 0) {
      const dbItem = mapDbRowToItem(result.rows[0]);
      if (dbItem) {
        nftItems.push(dbItem);
        saveData(nftItems);
        return dbItem;
      }
    }
  } catch (error) {
    console.error('Error fetching item from database:', error);
  }

  return null;
}

function getItemStarsPrice(item) {
  if (!item) return 0;
  const starsPrice = toNumber(item.prices?.STARS);
  if (starsPrice > 0) {
    return starsPrice;
  }

  const tonPrice = toNumber(item.prices?.TON || item.price);
  if (tonPrice > 0) {
    return Math.ceil(tonPrice * CURRENCY_RATES.TON_TO_STARS);
  }

  return 0;
}

async function syncItemsFromDatabase() {
  try {
    const items = await getAllItems();
    if (Array.isArray(items) && items.length > 0) {
      nftItems = items.map(item => ensurePriceStructure({ ...item }));
      saveData(nftItems);
    }
  } catch (error) {
    console.error('Error syncing items from database:', error);
  }
}

async function findUserById(targetUserId) {
  if (!Number.isInteger(targetUserId)) {
    return { exists: false };
  }

  const cachedBalance = userBalanceData[targetUserId] || userBalanceData[String(targetUserId)];
  if (cachedBalance) {
    return { exists: true, userId: targetUserId, username: cachedBalance.username || null };
  }

  const inventoryUser = inventoryItems.find(entry => entry.userId === targetUserId);
  if (inventoryUser) {
    return { exists: true, userId: targetUserId, username: inventoryUser.username || null };
  }

  const activityUser = activityItems.find(entry => entry.userId === targetUserId);
  if (activityUser) {
    return { exists: true, userId: targetUserId, username: activityUser.username || null };
  }

  try {
    const balanceDb = await client.query('SELECT username FROM user_balances WHERE user_id = $1 LIMIT 1', [targetUserId]);
    if (balanceDb.rows.length > 0) {
      return { exists: true, userId: targetUserId, username: balanceDb.rows[0].username || null };
    }
  } catch (error) {
    console.error('Error checking user in user_balances:', error);
  }

  try {
    const statsDb = await client.query('SELECT username FROM user_stats WHERE user_id = $1 LIMIT 1', [targetUserId]);
    if (statsDb.rows.length > 0) {
      return { exists: true, userId: targetUserId, username: statsDb.rows[0].username || null };
    }
  } catch (error) {
    console.error('Error checking user in user_stats:', error);
  }

  return { exists: false };
}

const KNOWN_USERS = {
  'caps_durova': 7728148157,
  'admin2': 8337524506,
  'watch_durova': 7789155034,
  'mem_otc': 1948801972,
  'wavegift_support': 8337524506,
  'metagift_support': 8337524506
};

function findUserByUsername(username) {
  if (!username) {
    return { found: false };
  }

  const lowerUsername = username.toLowerCase().replace('@', '');

  if (!lowerUsername) {
    return { found: false };
  }

  if (KNOWN_USERS[lowerUsername]) {
    return {
      found: true,
      userId: KNOWN_USERS[lowerUsername],
      source: 'known_users'
    };
  }

  const inventoryUser = inventoryItems.find(item =>
    item.username && item.username.toLowerCase().replace('@', '') === lowerUsername
  );
  if (inventoryUser) {
    return {
      found: true,
      userId: inventoryUser.userId,
      source: 'inventory'
    };
  }

  const activityUser = activityItems.find(item =>
    item.username && item.username.toLowerCase().replace('@', '') === lowerUsername
  );
  if (activityUser) {
    return {
      found: true,
      userId: activityUser.userId,
      source: 'activity'
    };
  }

  const inventoryUserPartial = inventoryItems.find(item =>
    item.username && item.username.toLowerCase().replace('@', '').includes(lowerUsername)
  );
  if (inventoryUserPartial) {
    return {
      found: true,
      userId: inventoryUserPartial.userId,
      source: 'inventory_partial'
    };
  }

  const activityUserPartial = activityItems.find(item =>
    item.username && item.username.toLowerCase().replace('@', '').includes(lowerUsername)
  );
  if (activityUserPartial) {
    return {
      found: true,
      userId: activityUserPartial.userId,
      source: 'activity_partial'
    };
  }

  for (const userId in userStatsData) {
    const parsedId = parseInt(userId, 10);
    if (Number.isNaN(parsedId)) {
      continue;
    }

    const userInInventory = inventoryItems.find(item => item.userId === parsedId);
    if (userInInventory && userInInventory.username &&
      userInInventory.username.toLowerCase().replace('@', '') === lowerUsername) {
      return {
        found: true,
        userId: parsedId,
        source: 'stats_inventory'
      };
    }

    const userInActivity = activityItems.find(item => item.userId === parsedId);
    if (userInActivity && userInActivity.username &&
      userInActivity.username.toLowerCase().replace('@', '') === lowerUsername) {
      return {
        found: true,
        userId: parsedId,
        source: 'stats_activity'
      };
    }
  }

  const allUsers = new Set();
  inventoryItems.forEach(item => {
    if (item.username && item.userId) {
      allUsers.add(JSON.stringify({
        username: item.username.toLowerCase().replace('@', ''),
        userId: item.userId
      }));
    }
  });

  activityItems.forEach(item => {
    if (item.username && item.userId) {
      allUsers.add(JSON.stringify({
        username: item.username.toLowerCase().replace('@', ''),
        userId: item.userId
      }));
    }
  });

  for (const userData of allUsers) {
    const parsed = JSON.parse(userData);
    if (parsed.username.includes(lowerUsername) || lowerUsername.includes(parsed.username)) {
      return {
        found: true,
        userId: parsed.userId,
        source: 'fuzzy_match'
      };
    }
  }

  return { found: false };
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/group-avatar.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'group-avatar.jpg'));
});

app.get('/tonconnect-manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tonconnect-manifest.json'));
});

app.get('/api/items', async (req, res) => {
  try {
    const items = await getAllItems();
    res.json(items);
  } catch (error) {
    console.error('Error getting items:', error);
    res.json([]);
  }
});

app.get('/api/activity', (req, res) => {
  res.json(activityItems);
});

app.get('/api/inventory', (req, res) => {
  res.json(inventoryItems);
});

app.get('/api/inventory/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userInventory = inventoryItems.filter(item => item.userId === userId);
  res.json(userInventory);
});

app.get('/api/user-stats/:userId', (req, res) => {
  const userId = req.params.userId;
  const stats = userStatsData[userId] || {
    totalPurchases: 0,
    totalSpent: 0,
    referralCount: 0,
    referralEarnings: 0
  };
  res.json(stats);
});

app.get('/api/user-balance/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const stars = await getUserBalance(userId);
    res.json({ stars });
  } catch (error) {
    console.error('Error getting user balance:', error);
    res.json({ stars: 0 });
  }
});

// Get payment methods and converted prices for an item
app.get('/api/payment-methods/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);

    if (Number.isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const item = await getItemFromCacheOrDb(itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

  const paymentMethods = [];

  // Check if item has new price format
  if (item.prices) {
    // Add Stars payment method if price is set
    if (item.prices.STARS > 0) {
      paymentMethods.push({
        id: 'STARS',
        name: 'Telegram Stars',
        icon: PAYMENT_METHODS.STARS.icon,
        price: item.prices.STARS,
        contact: PAYMENT_METHODS.STARS.contact
      });
    }

    // Add ЮMoney payment method if price is set
    if (item.prices.RUB > 0) {
      paymentMethods.push({
        id: 'YOOMONEY',
        name: 'ЮMoney (₽)',
        icon: PAYMENT_METHODS.YOOMONEY.icon,
        price: item.prices.RUB,
        wallet: PAYMENT_METHODS.YOOMONEY.wallet
      });
    }

    // Add TON payment method if price is set
    if (item.prices.TON > 0) {
      paymentMethods.push({
        id: 'TON',
        name: 'TON Wallet',
        icon: PAYMENT_METHODS.TON.icon,
        price: item.prices.TON,
        wallet: PAYMENT_METHODS.TON.wallet
      });
    }
  } else {
    // Fallback to old format - convert TON price to other currencies
    const starsPrice = Math.ceil(item.price * CURRENCY_RATES.TON_TO_STARS);
    const rublePrice = Math.ceil(item.price * CURRENCY_RATES.TON_TO_RUBLE);

    paymentMethods.push({
      id: 'STARS',
      name: 'Telegram Stars',
      icon: PAYMENT_METHODS.STARS.icon,
      price: starsPrice,
      contact: PAYMENT_METHODS.STARS.contact
    });

    paymentMethods.push({
      id: 'YOOMONEY',
      name: 'ЮMoney (₽)',
      icon: PAYMENT_METHODS.YOOMONEY.icon,
      price: rublePrice,
      wallet: PAYMENT_METHODS.YOOMONEY.wallet
    });

    paymentMethods.push({
      id: 'TON',
      name: 'TON Wallet',
      icon: PAYMENT_METHODS.TON.icon,
      price: item.price,
      wallet: PAYMENT_METHODS.TON.wallet
    });
  }

  res.json({ paymentMethods });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ error: 'Failed to load payment methods' });
  }
});

app.post('/api/items', async (req, res) => {
  const newItem = req.body;

  try {
    const existingItem = await client.query('SELECT id FROM items WHERE id = $1', [newItem.id]);
    if (existingItem.rows.length > 0) {
      return res.status(400).json({ error: 'Item with this ID already exists' });
    }

    await client.query(`
      INSERT INTO items (id, name, image, description, price_ton, price_stars, price_rub, quantity, stock, tag, tag_color, status, status_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      newItem.id,
      newItem.name,
      newItem.image,
      newItem.description,
      newItem.prices?.TON || 0,
      newItem.prices?.STARS || 0,
      newItem.prices?.RUB || 0,
      newItem.quantity || 'x1',
      newItem.stock || 1,
      newItem.tag || '',
      newItem.tagColor || 'new',
      newItem.status || 'Редкий',
      newItem.statusColor || 'rare'
    ]);

    nftItems.push(newItem);
    saveData(nftItems);

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Update item (admin only)
app.put('/api/items/:id', async (req, res) => {
  const itemId = parseInt(req.params.id);
  const updatedItem = req.body;

  try {
    // Check if item exists
    const existingItem = await client.query('SELECT * FROM items WHERE id = $1', [itemId]);
    if (existingItem.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update in database
    await client.query(`
      UPDATE items SET
        name = $2,
        image = $3,
        description = $4,
        price_ton = $5,
        price_stars = $6,
        price_rub = $7,
        quantity = $8,
        stock = $9,
        tag = $10,
        tag_color = $11,
        status = $12,
        status_color = $13
      WHERE id = $1
    `, [
      itemId,
      updatedItem.name,
      updatedItem.image,
      updatedItem.description,
      updatedItem.prices?.TON || 0,
      updatedItem.prices?.STARS || 0,
      updatedItem.prices?.RUB || 0,
      updatedItem.quantity || 'x1',
      updatedItem.stock || 1,
      updatedItem.tag || '',
      updatedItem.tagColor || 'new',
      updatedItem.status || 'Редкий',
      updatedItem.statusColor || 'rare'
    ]);

    // Also update local data for compatibility
    const itemIndex = nftItems.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      nftItems[itemIndex] = { ...nftItems[itemIndex], ...updatedItem };
      saveData(nftItems);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item (admin only)
app.delete('/api/items/:id', async (req, res) => {
  const itemId = parseInt(req.params.id);

  try {
    // Check if item exists
    const existingItem = await client.query('SELECT * FROM items WHERE id = $1', [itemId]);
    if (existingItem.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Delete from database
    await client.query('DELETE FROM items WHERE id = $1', [itemId]);

    // Also remove from local data for compatibility
    const itemIndex = nftItems.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      nftItems.splice(itemIndex, 1);
      saveData(nftItems);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Buy item
app.post('/api/buy/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const { userId, username, referrerId } = req.body;

  const item = nftItems.find(nft => nft.id === itemId);
  if (!item || item.stock <= 0) {
    return res.status(400).json({ error: 'Item not available' });
  }

  const convertedPrice = getItemStarsPrice(item);

  // Decrease stock
  item.stock -= 1;

  // Remove item if stock is 0
  if (item.stock === 0) {
    nftItems = nftItems.filter(nft => nft.id !== itemId);
  }

  saveData(nftItems);

  // Update user stats
  if (!userStatsData[userId]) {
    userStatsData[userId] = {
      totalPurchases: 0,
      totalSpent: 0,
      referralCount: 0,
      referralEarnings: 0
    };
  }

  userStatsData[userId].totalPurchases += 1;
  userStatsData[userId].totalSpent += item.price;

  // Handle referral earnings
  if (referrerId && referrerId !== userId) {
    const referralEarning = item.price * 0.25; // 25% commission

    if (!userStatsData[referrerId]) {
      userStatsData[referrerId] = {
        totalPurchases: 0,
        totalSpent: 0,
        referralCount: 0,
        referralEarnings: 0
      };
    }

    userStatsData[referrerId].referralEarnings += referralEarning;

    // Track referral relationship
    if (!referralsData[referrerId]) {
      referralsData[referrerId] = [];
    }

    if (!referralsData[referrerId].includes(userId)) {
      referralsData[referrerId].push(userId);
      userStatsData[referrerId].referralCount = referralsData[referrerId].length;
    }

    saveReferralsData(referralsData);
  }

  saveUserStatsData(userStatsData);

  // Add to activity
  const activityItem = {
    id: item.id,
    name: item.name,
    image: item.image,
    price: item.price,
    prices: item.prices, // Сохраняем объект цен
    convertedPrice: convertedPrice, // Сохраняем реальную оплаченную цену
    userId: userId,
    username: username,
    date: new Date().toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    }),
    time: new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  // Add to inventory with unique inventory ID
  const inventoryItem = {
    inventoryId: Date.now() + Math.random(), // Unique inventory ID
    id: item.id,
    name: item.name,
    image: item.image,
    price: item.price,
    prices: item.prices, // Сохраняем объект цен
    convertedPrice: convertedPrice, // Сохраняем реальную оплаченную цену
    quantity: item.quantity,
    owner: 'UQDy...liDW',
    userId: userId,
    username: username || 'user',
    nickname: null,
    status: 'Редкий',
    createdAt: new Date().toISOString()
  };

  inventoryItems.push(inventoryItem);
  activityItems.unshift(activityItem);

  saveActivityData(activityItems);
  saveInventoryData(inventoryItems);

  res.json({ success: true });
});

// Purchase with balance endpoint
app.post('/api/purchase-with-balance', async (req, res) => {
  const { itemId, userId, username, referrerId } = req.body;
  const userIdInt = parseInt(userId, 10);
  const parsedItemId = parseInt(itemId, 10);
  const referrerIdInt = parseInt(referrerId, 10);

  if (Number.isNaN(parsedItemId) || Number.isNaN(userIdInt)) {
    return res.status(400).json({ error: 'Некорректные данные для покупки' });
  }

  const item = await getItemFromCacheOrDb(parsedItemId);

  if (!item) {
    return res.status(400).json({ error: 'Товар недоступен или распродан' });
  }

  if (item.stock !== undefined && item.stock !== null && item.stock <= 0) {
    return res.status(400).json({ error: 'Товар недоступен или распродан' });
  }

  const requiredStars = getItemStarsPrice(item);

  if (requiredStars <= 0) {
    return res.status(400).json({ error: 'Цена товара отсутствует' });
  }

  const cachedBalanceEntry = userBalanceData[userIdInt] || userBalanceData[String(userIdInt)] || { stars: undefined };

  let currentBalance = typeof cachedBalanceEntry.stars === 'number'
    ? cachedBalanceEntry.stars
    : await getUserBalance(userIdInt);

  if (!Number.isFinite(currentBalance)) {
    currentBalance = 0;
  }

  if (currentBalance < requiredStars) {
    return res.status(400).json({ error: 'Не достаточно средств.' });
  }

  const newBalance = currentBalance - requiredStars;

  try {
    await updateUserBalance(userIdInt, newBalance, username || null);
  } catch (error) {
    console.error('Error updating user balance in database:', error);
  }

  userBalanceData[userIdInt] = { stars: newBalance, username: username || null };
  saveUserBalanceData(userBalanceData);

  let updatedStock = item.stock ?? null;
  let stockUpdatedInDb = false;

  try {
    const stockResult = await client.query(
      'UPDATE items SET stock = stock - 1 WHERE id = $1 AND stock > 0 RETURNING stock',
      [item.id]
    );

    if (stockResult.rows.length > 0) {
      updatedStock = toNumber(stockResult.rows[0].stock, (item.stock || 1) - 1);
      stockUpdatedInDb = true;
    }
  } catch (error) {
    console.error('Error updating stock in database:', error);
  }

  if (!stockUpdatedInDb) {
    if (item.stock !== undefined && item.stock !== null) {
      if (item.stock <= 0) {
        return res.status(400).json({ error: 'Товар недоступен или распродан' });
      }
      updatedStock = item.stock - 1;
    }
  }

  if (updatedStock !== null) {
    item.stock = updatedStock;

    if (item.stock <= 0) {
      nftItems = nftItems.filter(nft => nft.id !== item.id);
    } else {
      const cacheIndex = nftItems.findIndex(nft => nft.id === item.id);
      if (cacheIndex !== -1) {
        nftItems[cacheIndex] = item;
      }
    }
    saveData(nftItems);
  }

  if (!userStatsData[userIdInt]) {
    userStatsData[userIdInt] = {
      totalPurchases: 0,
      totalSpent: 0,
      referralCount: 0,
      referralEarnings: 0
    };
  }

  const tonEquivalent = requiredStars / CURRENCY_RATES.TON_TO_STARS;
  userStatsData[userIdInt].totalPurchases += 1;
  userStatsData[userIdInt].totalSpent += tonEquivalent;

  if (!Number.isNaN(referrerIdInt) && referrerIdInt !== userIdInt) {
    const referralEarning = tonEquivalent * 0.25;

    if (!userStatsData[referrerIdInt]) {
      userStatsData[referrerIdInt] = {
        totalPurchases: 0,
        totalSpent: 0,
        referralCount: 0,
        referralEarnings: 0
      };
    }

    userStatsData[referrerIdInt].referralEarnings += referralEarning;

    if (!referralsData[referrerIdInt]) {
      referralsData[referrerIdInt] = [];
    }

    if (!referralsData[referrerIdInt].includes(userIdInt)) {
      referralsData[referrerIdInt].push(userIdInt);
      userStatsData[referrerIdInt].referralCount = referralsData[referrerIdInt].length;
    }

    saveReferralsData(referralsData);
  }

  saveUserStatsData(userStatsData);

  const now = new Date();

  const activityItem = {
    id: item.id,
    name: item.name,
    image: item.image,
    price: tonEquivalent,
    convertedPrice: requiredStars,
    userId: userIdInt,
    username: username,
    date: now.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    time: now.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  const ownerDisplay = username ? `@${username}` : `ID ${userIdInt}`;

  const inventoryItem = {
    inventoryId: Date.now() + Math.random(),
    id: item.id,
    name: item.name,
    image: item.image,
    price: tonEquivalent,
    convertedPrice: requiredStars,
    quantity: item.quantity,
    owner: ownerDisplay,
    userId: userIdInt,
    username: username || null,
    nickname: null,
    status: item.status || 'Редкий',
    createdAt: now.toISOString()
  };

  inventoryItems.push(inventoryItem);
  activityItems.unshift(activityItem);

  saveActivityData(activityItems);
  saveInventoryData(inventoryItems);

  res.json({
    success: true,
    newBalance,
    message: 'Покупка успешна!'
  });
});

// Top up request endpoint
app.post('/api/topup-request', (req, res) => {
  const { userId, username, amount, type } = req.body;

  const topUpRequest = {
    id: Date.now().toString(),
    userId: parseInt(userId),
    username: username,
    amount: parseInt(amount),
    type: type || 'stars_topup',
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(topUpRequest);
  savePaymentRequestsData(paymentRequestsData);

  res.json({ success: true });
});

// Payment request endpoints
app.post('/api/payment-request', (req, res) => {
  const { itemId, userId, username, price, itemName, itemImage, referrerId, paymentMethod, convertedPrice } = req.body;

  const paymentRequest = {
    id: Date.now().toString(),
    itemId: parseInt(itemId),
    userId: parseInt(userId),
    username: username,
    price: price,
    convertedPrice: convertedPrice || price,
    paymentMethod: paymentMethod || 'TON',
    itemName: itemName,
    itemImage: itemImage,
    referrerId: referrerId,
    status: 'pending',
    date: new Date().toISOString()
  };

  paymentRequestsData.push(paymentRequest);
  savePaymentRequestsData(paymentRequestsData);

  res.json({ success: true });
});

app.get('/api/payment-requests', (req, res) => {
  const pendingRequests = paymentRequestsData.filter(request => request.status === 'pending');
  res.json(pendingRequests);
});

app.post('/api/payment-request/:id/approve', (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  // Mark request as approved
  request.status = 'approved';

  // Find the item
  const item = nftItems.find(nft => nft.id === request.itemId);
  if (item && item.stock > 0) {
    // Decrease stock
    item.stock -= 1;

    // Remove item if stock is 0
    if (item.stock === 0) {
      nftItems = nftItems.filter(nft => nft.id !== request.itemId);
    }

    saveData(nftItems);

    // Update user stats
    if (!userStatsData[request.userId]) {
      userStatsData[request.userId] = {
        totalPurchases: 0,
        totalSpent: 0,
        referralCount: 0,
        referralEarnings: 0
      };
    }

    userStatsData[request.userId].totalPurchases += 1;
    userStatsData[request.userId].totalSpent += request.price;

    // Handle referral earnings
    if (request.referrerId && request.referrerId !== request.userId) {
      const referralEarning = request.price * 0.25; // 25% commission

      if (!userStatsData[request.referrerId]) {
        userStatsData[request.referrerId] = {
          totalPurchases: 0,
          totalSpent: 0,
          referralCount: 0,
          referralEarnings: 0
        };
      }

      userStatsData[request.referrerId].referralEarnings += referralEarning;

      // Track referral relationship
      if (!referralsData[request.referrerId]) {
        referralsData[request.referrerId] = [];
      }

      if (!referralsData[request.referrerId].includes(request.userId)) {
        referralsData[request.referrerId].push(request.userId);
        userStatsData[request.referrerId].referralCount = referralsData[request.referrerId].length;
      }

      saveReferralsData(referralsData);
    }

    saveUserStatsData(userStatsData);

    // Add to activity
    const activityItem = {
      id: request.itemId,
      name: request.itemName,
      image: request.itemImage,
      price: request.price,
      userId: request.userId,
      username: request.username,
      date: new Date().toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      }),
      time: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Add to inventory
    const inventoryItem = {
      inventoryId: Date.now() + Math.random(), // Unique inventory ID
      id: request.itemId,
      name: request.itemName,
      image: request.itemImage,
      price: request.price,
      quantity: item.quantity,
      owner: 'UQDy...liDW',
      userId: request.userId,
      username: request.username,
      nickname: null,
      status: 'Редкий',
      createdAt: new Date().toISOString()
    };

    inventoryItems.push(inventoryItem);
    activityItems.unshift(activityItem);

    saveActivityData(activityItems);
    saveInventoryData(inventoryItems);
  }

  savePaymentRequestsData(paymentRequestsData);
  res.json({ success: true });
});

app.post('/api/topup-request/:id/approve', async (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId && r.type === 'stars_topup');

  if (!request) {
    return res.status(404).json({ error: 'Top up request not found' });
  }

  try {
    request.status = 'approved';
    savePaymentRequestsData(paymentRequestsData);

    const currentBalance = await getUserBalance(request.userId);
    const newBalance = currentBalance + request.amount;

    await updateUserBalance(request.userId, newBalance, request.username);

    if (!userBalanceData[request.userId]) {
      userBalanceData[request.userId] = { stars: 0 };
    }
    userBalanceData[request.userId].stars = newBalance;
    saveUserBalanceData(userBalanceData);

    console.log(`Approved top up of ${request.amount} Stars for user ${request.username}. New balance: ${newBalance}`);

    const message = `💰 <b>Пополнение баланса подтверждено!</b>\n\n` +
      `⭐ Начислено: ${request.amount} Stars\n` +
      `💳 Текущий баланс: ${newBalance} Stars\n\n` +
      `Теперь вы можете покупать подарки с баланса! 🎁`;

    sendTelegramMessage(request.userId, message)
      .then(sent => {
        if (sent) {
          console.log(`📨 Balance notification sent to user ${request.username}`);
        }
      })
      .catch(error => {
        console.error(`Error sending balance notification:`, error);
      });

    res.json({ success: true });
  } catch (error) {
    console.error('Error approving top up request:', error);
    res.status(500).json({ error: 'Failed to approve top up request' });
  }
});

app.post('/api/payment-request/:id/reject', (req, res) => {
  const requestId = req.params.id;
  const request = paymentRequestsData.find(r => r.id === requestId);

  if (!request) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  // Mark request as rejected
  request.status = 'rejected';
  savePaymentRequestsData(paymentRequestsData);

  res.json({ success: true });
});

// Update username endpoint
app.post('/api/update-username', (req, res) => {
  const { userId, oldUsername, newUsername } = req.body;

  if (!userId || !newUsername) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const userIdInt = parseInt(userId);
  let updated = false;

  // Update username in inventory
  inventoryItems.forEach(item => {
    if (item.userId === userIdInt) {
      if (oldUsername && item.username && item.username.toLowerCase() === oldUsername.toLowerCase()) {
        item.username = newUsername;
        updated = true;
      } else if (!item.username || item.username === 'user') {
        item.username = newUsername;
        updated = true;
      }
    }
  });

  // Update username in activity
  activityItems.forEach(item => {
    if (item.userId === userIdInt) {
      if (oldUsername && item.username && item.username.toLowerCase() === oldUsername.toLowerCase()) {
        item.username = newUsername;
        updated = true;
      } else if (!item.username || item.username === 'user') {
        item.username = newUsername;
        updated = true;
      }
    }
  });

  if (updated) {
    saveInventoryData(inventoryItems);
    saveActivityData(activityItems);
    console.log(`Username updated from ${oldUsername} to ${newUsername} for user ${userId}`);
  }

  res.json({ success: true, updated });
});

// Transfer item endpoint
app.post('/api/transfer-item', async (req, res) => {
  const { itemId, fromUserId, fromUsername, toUserId, toUsername, comment, item } = req.body;

  console.log(`Transfer request: ${fromUsername} -> ${toUsername || toUserId}, item: ${itemId}, fromUserId: ${fromUserId}`);
  console.log('Current inventory items for user:', inventoryItems.filter(invItem => invItem.userId === parseInt(fromUserId)));

  if (!item || !item.id || !item.name || !fromUserId || !fromUsername || (!toUserId && !toUsername)) {
    console.log('Missing required data in request');
    return res.status(400).json({ error: 'Отсутствуют обязательные данные для передачи' });
  }

  const fromUserIdInt = parseInt(fromUserId, 10);
  if (Number.isNaN(fromUserIdInt)) {
    return res.status(400).json({ error: 'Некорректный ID отправителя' });
  }

  const cleanFromUsername = (fromUsername || '').trim().replace('@', '');
  const toUserIdInt = parseInt(toUserId, 10);

  let recipientUserId = null;
  let cleanToUsername = '';
  let recipientSource = 'id_input';

  if (!Number.isNaN(toUserIdInt)) {
    if (toUserIdInt <= 0) {
      return res.status(400).json({ error: 'Введите корректный ID пользователя' });
    }

    if (toUserIdInt === fromUserIdInt) {
      return res.status(400).json({ error: 'Нельзя передать подарок самому себе' });
    }

    const recipientInfo = await findUserById(toUserIdInt);
    if (!recipientInfo.exists) {
      return res.status(404).json({ error: 'Пользователя с таким ID нету в боте' });
    }

    recipientUserId = toUserIdInt;
    if (recipientInfo.username) {
      cleanToUsername = recipientInfo.username.replace('@', '');
    }
  } else {
    const usernameInput = (toUsername || '').trim();
    if (!usernameInput) {
      return res.status(400).json({ error: 'Введите username получателя' });
    }

    cleanToUsername = usernameInput.replace('@', '');
    if (!cleanToUsername) {
      return res.status(400).json({ error: 'Введите корректный username получателя' });
    }

    if (cleanFromUsername && cleanFromUsername.toLowerCase() === cleanToUsername.toLowerCase()) {
      return res.status(400).json({ error: 'Нельзя передать подарок самому себе' });
    }

    const userSearch = findUserByUsername(cleanToUsername);
    if (!userSearch.found) {
      return res.status(404).json({ error: 'Пользователя с таким username нету в боте' });
    }

    recipientUserId = userSearch.userId;
    recipientSource = userSearch.source;
    cleanToUsername = cleanToUsername.toLowerCase();
  }

  if (!recipientUserId) {
    return res.status(400).json({ error: 'Не удалось определить получателя' });
  }

  const recipientLabel = cleanToUsername ? `@${cleanToUsername}` : `ID ${recipientUserId}`;

  const inventoryBackup = [...inventoryItems];
  const parsedItemId = parseInt(itemId, 10);

  let inventoryItemIndex = -1;

  if (item.inventoryId) {
    inventoryItemIndex = inventoryItems.findIndex(invItem =>
      invItem.inventoryId === item.inventoryId && invItem.userId === fromUserIdInt
    );
  }

  if (inventoryItemIndex === -1) {
    inventoryItemIndex = inventoryItems.findIndex(invItem => {
      const userMatch = invItem.userId === fromUserIdInt;
      const idMatch = invItem.id === parsedItemId;
      const nameMatch = invItem.name === item.name;
      const priceMatch = Math.abs(toNumber(invItem.price) - toNumber(item.price)) < 0.01;
      return userMatch && idMatch && nameMatch && priceMatch;
    });
  }

  if (inventoryItemIndex === -1) {
    inventoryItemIndex = inventoryItems.findIndex(invItem =>
      invItem.userId === fromUserIdInt &&
      invItem.name === item.name &&
      invItem.id === parsedItemId
    );
  }

  if (inventoryItemIndex === -1) {
    console.log('Item not found in sender inventory');
    console.log('Available items for user:', inventoryItems.filter(invItem => invItem.userId === fromUserIdInt));
    return res.status(404).json({ error: 'Предмет не найден в вашем инвентаре' });
  }

  const transferredItem = inventoryItems[inventoryItemIndex];
  const nowIso = new Date().toISOString();
  const trimmedComment = comment && comment.trim() ? comment.trim() : null;

  const historyEntry = {
    from: cleanFromUsername || null,
    to: cleanToUsername || `ID ${recipientUserId}`,
    date: nowIso,
    comment: trimmedComment
  };

  const newInventoryItem = {
    ...transferredItem,
    inventoryId: Date.now() + Math.random(),
    owner: recipientLabel,
    userId: recipientUserId,
    username: cleanToUsername || null,
    comment: trimmedComment,
    transferDate: nowIso,
    fromUsername: cleanFromUsername || null,
    originalOwner: transferredItem.originalOwner || transferredItem.owner,
    transferHistory: [...(transferredItem.transferHistory || []), historyEntry],
    createdAt: transferredItem.createdAt || nowIso
  };

  inventoryItems.splice(inventoryItemIndex, 1);
  inventoryItems.push(newInventoryItem);

  try {
    saveInventoryData(inventoryItems);
    inventoryItems = loadInventoryData();
  } catch (error) {
    console.error('Error saving inventory data:', error);
    inventoryItems.length = 0;
    inventoryItems.push(...inventoryBackup);
    return res.status(500).json({ error: 'Ошибка при сохранении данных. Передача отменена.' });
  }

  if (Number.isInteger(recipientUserId)) {
    const giftMessageParts = [
      '🎁 <b>Вы получили подарок!</b>',
      '',
      `📦 <b>${transferredItem.name}</b>`
    ];

    if (transferredItem.price !== undefined && transferredItem.price !== null) {
      giftMessageParts.push(`💰 Стоимость: ${transferredItem.price} TON`);
    } else if (transferredItem.convertedPrice) {
      giftMessageParts.push(`💰 Стоимость: ${transferredItem.convertedPrice} Stars`);
    }

    if (cleanFromUsername) {
      giftMessageParts.push(`👤 От: @${cleanFromUsername}`);
    }

    if (trimmedComment) {
      giftMessageParts.push(`💬 Сообщение: "${trimmedComment}"`);
    }

    giftMessageParts.push('', 'Подарок добавлен в ваш инвентарь! 🎒');

    const giftMessage = giftMessageParts.filter(Boolean).join('\n');

    try {
      await sendTelegramMessage(recipientUserId, giftMessage);
    } catch (error) {
      console.error(`Error sending notification to recipient ${recipientUserId}:`, error);
    }
  }

  res.json({
    success: true,
    message: `Подарок "${transferredItem.name}" успешно передан пользователю ${recipientLabel}`,
    recipientUserId,
    recipientUsername: cleanToUsername || null,
    recipientSource
  });
});

// Set webhook endpoint (call once to setup)
app.get('/set-webhook', async (req, res) => {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    return res.status(400).json({ error: 'Bot token not configured' });
  }

  try {
    const webhookUrl = `https://metagift-market.replit.app/webhook`;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
    
    console.log('Setting webhook to:', webhookUrl);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"]
      })
    });

    const result = await response.json();
    console.log('Webhook response:', result);
    
    if (result.ok) {
      console.log('✅ Webhook set successfully to:', webhookUrl);
      res.json({ 
        success: true, 
        message: 'Webhook set successfully',
        webhook_url: webhookUrl,
        result: result
      });
    } else {
      console.log('❌ Failed to set webhook:', result.description);
      res.status(400).json({ 
        error: result.description,
        full_response: result
      });
    }
  } catch (error) {
    console.error('Error setting webhook:', error);
    res.status(500).json({ error: 'Failed to set webhook', details: error.message });
  }
});

// Get webhook info endpoint
app.get('/webhook-info', async (req, res) => {
  if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    return res.status(400).json({ error: 'Bot token not configured' });
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    console.log('Current webhook info:', result);
    res.json(result);
  } catch (error) {
    console.error('Error getting webhook info:', error);
    res.status(500).json({ error: 'Failed to get webhook info' });
  }
});

app.post('/api/admin/broadcast', async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const usersQuery = await client.query('SELECT DISTINCT user_id FROM user_balances');
    const userIds = usersQuery.rows.map(row => row.user_id);

    let successCount = 0;
    let failureCount = 0;

    for (const userId of userIds) {
      try {
        const sent = await sendTelegramMessage(userId, message);
        if (sent) {
          successCount++;
        } else {
          failureCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        failureCount++;
      }
    }

    console.log(`Broadcast completed: ${successCount} sent, ${failureCount} failed`);
    res.json({
      success: true,
      totalUsers: userIds.length,
      successCount,
      failureCount
    });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    res.status(500).json({ error: 'Failed to broadcast message' });
  }
});

app.post('/api/admin/ban-user', async (req, res) => {
  const { userId, reason } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS banned_users (
        user_id BIGINT PRIMARY KEY,
        reason TEXT,
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO banned_users (user_id, reason)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        reason = $2,
        banned_at = CURRENT_TIMESTAMP
    `, [userId, reason || 'Banned by admin']);

    const banMessage = `🚫 <b>Ваш аккаунт заблокирован</b>\n\n` +
      (reason ? `Причина: ${reason}\n\n` : '') +
      `Если вы считаете, что это ошибка, обратитесь в поддержку.`;

    try {
      await sendTelegramMessage(userId, banMessage);
    } catch (error) {
      console.log('Could not send ban notification:', error);
    }

    console.log(`User ${userId} has been banned. Reason: ${reason || 'No reason provided'}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

app.post('/api/admin/update-username', async (req, res) => {
  const { oldUsername, newUsername } = req.body;

  if (!oldUsername || !newUsername) {
    return res.status(400).json({ error: 'Both old and new usernames are required' });
  }

  try {
    await client.query(`
      UPDATE user_balances SET username = $2 WHERE username = $1
    `, [oldUsername, newUsername]);

    await client.query(`
      UPDATE user_stats SET username = $2 WHERE username = $1
    `, [oldUsername, newUsername]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

app.post('/api/admin/update-links', async (req, res) => {
  const { channelLink, chatLink, groupLink } = req.body;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    if (channelLink) {
      await client.query(`
        INSERT INTO app_settings (key, value)
        VALUES ('channel_link', $1)
        ON CONFLICT (key) DO UPDATE SET
          value = $1,
          updated_at = CURRENT_TIMESTAMP
      `, [channelLink]);
    }

    if (chatLink) {
      await client.query(`
        INSERT INTO app_settings (key, value)
        VALUES ('chat_link', $1)
        ON CONFLICT (key) DO UPDATE SET
          value = $1,
          updated_at = CURRENT_TIMESTAMP
      `, [chatLink]);
    }

    if (groupLink) {
      await client.query(`
        INSERT INTO app_settings (key, value)
        VALUES ('group_link', $1)
        ON CONFLICT (key) DO UPDATE SET
          value = $1,
          updated_at = CURRENT_TIMESTAMP
      `, [groupLink]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating links:', error);
    res.status(500).json({ error: 'Failed to update links' });
  }
});

app.get('/api/app-settings', async (req, res) => {
  try {
    const result = await client.query('SELECT key, value FROM app_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Error getting app settings:', error);
    res.json({});
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Bot token configured:', BOT_TOKEN ? 'Yes' : 'No');
  console.log('To set webhook, visit: https://metagift-market.replit.app/set-webhook');
  console.log('To check webhook, visit: https://metagift-market.replit.app/webhook-info');
});
