/*  api.js
    TradeSmart Stock Trading System (Frontend API Layer)

    ✅ Supports BOTH modes:
    - Mock mode (no backend needed) when CONFIG.USE_MOCK = true
    - Backend mode (Zamir's API) when CONFIG.USE_MOCK = false

    Notes:
    - Requires config.js to define CONFIG.API_BASE_URL (e.g., http://localhost:5000)
    - Zamir backend routes are root-based (no /api prefix), so CONFIG.API_PREFIX should be ""
*/

/* -----------------------------
   Configuration
------------------------------ */
const USE_MOCK =
  typeof CONFIG !== "undefined" && typeof CONFIG.USE_MOCK === "boolean"
    ? CONFIG.USE_MOCK
    : true; // default mock ON

const API_BASE_URL =
  typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL
    ? CONFIG.API_BASE_URL
    : "http://localhost:5000";

const API_PREFIX =
  typeof CONFIG !== "undefined" && CONFIG.API_PREFIX ? CONFIG.API_PREFIX : "";

/* -----------------------------
   Mock Data Store (in-memory)
   NOTE: resets when page refreshes
------------------------------ */
let mockStocks = [
  {
    ticker: "AAPL",
    companyName: "Apple Inc.",
    price: 182.34,
    open: 180.12,
    high: 183.5,
    low: 179.8,
    volume: 1000000,
  },
  {
    ticker: "MSFT",
    companyName: "Microsoft Corp.",
    price: 405.22,
    open: 402.0,
    high: 407.1,
    low: 400.5,
    volume: 750000,
  },
  {
    ticker: "TSLA",
    companyName: "Tesla Inc.",
    price: 192.75,
    open: 190.1,
    high: 195.2,
    low: 188.9,
    volume: 1200000,
  },
];

let mockUsers = [
  {
    userId: "u1001",
    fullName: "Demo User",
    cash: 10000.0,
    holdings: [
      { ticker: "AAPL", shares: 10, avgCost: 175.0 },
      { ticker: "MSFT", shares: 5, avgCost: 390.0 },
    ],
  },
];

let mockTransactions = [
  {
    txId: "t9001",
    userId: "u1001",
    type: "BUY",
    ticker: "AAPL",
    shares: 10,
    price: 175.0,
    total: 1750.0,
    status: "EXECUTED",
    timestamp: new Date().toISOString(),
  },
];

let mockOrders = [
  // open/pending orders (for cancel feature)
  // { orderId, userId, type, ticker, shares, requestedAt, status }
];

let mockMarketConfig = {
  marketHours: { open: "09:30", close: "16:00", timezone: "America/New_York" },
  marketSchedule: { weekdaysOnly: true, closedHolidays: true },
};

/* -----------------------------
   Helpers
------------------------------ */
function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findStock(ticker) {
  return mockStocks.find((s) => s.ticker === ticker.toUpperCase());
}

function getMarketCap(stock) {
  return Number((stock.price * stock.volume).toFixed(2));
}

function getUser(userId) {
  return mockUsers.find((u) => u.userId === userId);
}

function newId(prefix) {
  return `${prefix}${Math.floor(Math.random() * 1e9)}`;
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * apiFetch(path, options)
 * - path should start with "/" (e.g., "/stocks")
 * - Automatically applies API_BASE_URL + API_PREFIX
 * - Throws readable errors (uses JSON {message} if provided)
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${API_PREFIX}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      data && data.message ? data.message : `HTTP ${res.status} on ${path}`;
    throw new Error(msg);
  }
  return data;
}

/* -----------------------------
   API: Customer Functions
------------------------------ */

/**
 * getStocks()
 * Returns list of available stocks with market cap.
 */
async function getStocks() {
  if (!USE_MOCK) {
    return await apiFetch("/stocks");
  }

  await delay();
  return mockStocks.map((s) => ({
    ...s,
    marketCap: getMarketCap(s),
  }));
}

/**
 * buyStock(order)
 * order = { userId, ticker, shares }
 */
async function buyStock(order) {
  if (!USE_MOCK) {
    return await apiFetch("/orders/buy", {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  await delay();

  const user = getUser(order.userId);
  if (!user) throw new Error("User not found");

  const stock = findStock(order.ticker);
  if (!stock) throw new Error("Stock not found");

  const shares = Number(order.shares);
  if (!Number.isFinite(shares) || shares <= 0) throw new Error("Invalid shares");

  const cost = Number((shares * stock.price).toFixed(2));
  if (user.cash < cost) throw new Error("Insufficient cash balance");

  // Create a PENDING order (can be canceled before executed)
  const orderId = newId("o");
  const pendingOrder = {
    orderId,
    userId: user.userId,
    type: "BUY",
    ticker: stock.ticker,
    shares,
    requestedAt: nowISO(),
    status: "PENDING",
    priceAtRequest: stock.price,
  };
  mockOrders.push(pendingOrder);

  return {
    message: `Buy order created (PENDING): ${shares} shares of ${stock.ticker}`,
    order: pendingOrder,
  };
}

/**
 * sellStock(order)
 * order = { userId, ticker, shares }
 */
async function sellStock(order) {
  if (!USE_MOCK) {
    return await apiFetch("/orders/sell", {
      method: "POST",
      body: JSON.stringify(order),
    });
  }

  await delay();

  const user = getUser(order.userId);
  if (!user) throw new Error("User not found");

  const stock = findStock(order.ticker);
  if (!stock) throw new Error("Stock not found");

  const shares = Number(order.shares);
  if (!Number.isFinite(shares) || shares <= 0) throw new Error("Invalid shares");

  const holding = user.holdings.find((h) => h.ticker === stock.ticker);
  if (!holding || holding.shares < shares) throw new Error("Not enough shares");

  // Create a PENDING order (can be canceled before executed)
  const orderId = newId("o");
  const pendingOrder = {
    orderId,
    userId: user.userId,
    type: "SELL",
    ticker: stock.ticker,
    shares,
    requestedAt: nowISO(),
    status: "PENDING",
    priceAtRequest: stock.price,
  };
  mockOrders.push(pendingOrder);

  return {
    message: `Sell order created (PENDING): ${shares} shares of ${stock.ticker}`,
    order: pendingOrder,
  };
}

/**
 * cancelOrder(orderId)
 * Cancels a pending order before executed.
 */
async function cancelOrder(orderId) {
  if (!USE_MOCK) {
    return await apiFetch(`/orders/${orderId}/cancel`, {
      method: "POST",
    });
  }

  await delay();

  const order = mockOrders.find((o) => o.orderId === orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING") throw new Error("Only PENDING orders can be canceled");

  order.status = "CANCELED";

  mockTransactions.push({
    txId: newId("t"),
    userId: order.userId,
    type: "CANCEL",
    ticker: order.ticker,
    shares: order.shares,
    price: order.priceAtRequest,
    total: Number((order.shares * order.priceAtRequest).toFixed(2)),
    status: "CANCELED",
    timestamp: nowISO(),
  });

  return { message: "Order canceled", order };
}

/**
 * getPortfolio(userId)
 */
async function getPortfolio(userId) {
  if (!USE_MOCK) {
    return await apiFetch(`/users/${userId}/portfolio`);
  }

  await delay();

  const user = getUser(userId);
  if (!user) throw new Error("User not found");

  const holdings = user.holdings.map((h) => {
    const s = findStock(h.ticker);
    const currentPrice = s ? s.price : 0;
    const marketValue = Number((h.shares * currentPrice).toFixed(2));
    return { ...h, currentPrice, marketValue };
  });

  const totalStockValue = Number(
    holdings.reduce((sum, h) => sum + h.marketValue, 0).toFixed(2)
  );

  const totalAccountValue = Number((user.cash + totalStockValue).toFixed(2));

  return {
    userId: user.userId,
    cash: user.cash,
    holdings,
    totalStockValue,
    totalAccountValue,
  };
}

/**
 * getTransactions(userId)
 */
async function getTransactions(userId) {
  if (!USE_MOCK) {
    return await apiFetch(`/users/${userId}/transactions`);
  }

  await delay();
  return mockTransactions.filter((t) => t.userId === userId);
}

/**
 * depositCash(data)
 * data = { userId, amount }
 */
async function depositCash(data) {
  if (!USE_MOCK) {
    return await apiFetch(`/users/${data.userId}/deposit`, {
      method: "POST",
      body: JSON.stringify({ amount: data.amount }),
    });
  }

  await delay();

  const user = getUser(data.userId);
  if (!user) throw new Error("User not found");

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Deposit amount must be greater than 0");

  user.cash = Number((user.cash + amount).toFixed(2));

  mockTransactions.push({
    txId: newId("t"),
    userId: user.userId,
    type: "DEPOSIT",
    ticker: "CASH",
    shares: 0,
    price: amount,
    total: amount,
    status: "EXECUTED",
    timestamp: nowISO(),
  });

  return { message: `Deposited ${amount.toFixed(2)} to cash account`, cash: user.cash };
}

/**
 * withdrawCash(data)
 * data = { userId, amount }
 */
async function withdrawCash(data) {
  if (!USE_MOCK) {
    return await apiFetch(`/users/${data.userId}/withdraw`, {
      method: "POST",
      body: JSON.stringify({ amount: data.amount }),
    });
  }

  await delay();

  const user = getUser(data.userId);
  if (!user) throw new Error("User not found");

  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Withdraw amount must be greater than 0");

  if (user.cash < amount) throw new Error("Insufficient cash balance");

  user.cash = Number((user.cash - amount).toFixed(2));

  mockTransactions.push({
    txId: newId("t"),
    userId: user.userId,
    type: "WITHDRAW",
    ticker: "CASH",
    shares: 0,
    price: amount,
    total: amount,
    status: "EXECUTED",
    timestamp: nowISO(),
  });

  return { message: `Withdrew ${amount.toFixed(2)} from cash account`, cash: user.cash };
}

/* -----------------------------
   API: Admin Functions
------------------------------ */

/**
 * adminCreateStock(stock)
 * stock = { companyName, ticker, volume, initialPrice }
 */
async function adminCreateStock(stock) {
  if (!USE_MOCK) {
    return await apiFetch("/admin/stocks", {
      method: "POST",
      body: JSON.stringify(stock),
    });
  }

  await delay();

  const ticker = stock.ticker.toUpperCase();
  if (findStock(ticker)) throw new Error("Stock ticker already exists");

  const newStock = {
    ticker,
    companyName: stock.companyName,
    price: Number(stock.initialPrice),
    open: Number(stock.initialPrice),
    high: Number(stock.initialPrice),
    low: Number(stock.initialPrice),
    volume: Number(stock.volume),
  };

  mockStocks.push(newStock);
  return { message: "Stock created", stock: { ...newStock, marketCap: getMarketCap(newStock) } };
}

/**
 * adminUpdateMarketHours(data)
 * data = { open, close, timezone }
 */
async function adminUpdateMarketHours(data) {
  if (!USE_MOCK) {
    return await apiFetch("/admin/market/hours", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  await delay();
  mockMarketConfig.marketHours = { ...data };
  return { message: "Market hours updated", marketHours: mockMarketConfig.marketHours };
}

/**
 * adminUpdateMarketSchedule(data)
 * data = { weekdaysOnly, closedHolidays }
 */
async function adminUpdateMarketSchedule(data) {
  if (!USE_MOCK) {
    return await apiFetch("/admin/market/schedule", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  await delay();
  mockMarketConfig.marketSchedule = { ...data };
  return { message: "Market schedule updated", marketSchedule: mockMarketConfig.marketSchedule };
}

/**
 * executePendingOrders(userId)
 * OPTIONAL: mock-only helper for demo "execution"
 */
async function executePendingOrders(userId) {
  if (!USE_MOCK) {
    throw new Error(
      "executePendingOrders is mock-only. Use real backend execution logic instead."
    );
  }

  await delay();

  const user = getUser(userId);
  if (!user) throw new Error("User not found");

  // Execute all pending orders for this user
  const pending = mockOrders.filter((o) => o.userId === userId && o.status === "PENDING");

  pending.forEach((order) => {
    const stock = findStock(order.ticker);
    if (!stock) {
      order.status = "REJECTED";
      return;
    }

    const total = Number((order.shares * stock.price).toFixed(2));

    if (order.type === "BUY") {
      if (user.cash >= total) {
        user.cash = Number((user.cash - total).toFixed(2));
        const holding = user.holdings.find((h) => h.ticker === stock.ticker);
        if (holding) {
          const newTotalShares = holding.shares + order.shares;
          const newAvgCost =
            (holding.avgCost * holding.shares + stock.price * order.shares) / newTotalShares;
          holding.shares = newTotalShares;
          holding.avgCost = Number(newAvgCost.toFixed(2));
        } else {
          user.holdings.push({ ticker: stock.ticker, shares: order.shares, avgCost: stock.price });
        }

        order.status = "EXECUTED";
        mockTransactions.push({
          txId: newId("t"),
          userId,
          type: "BUY",
          ticker: stock.ticker,
          shares: order.shares,
          price: stock.price,
          total,
          status: "EXECUTED",
          timestamp: nowISO(),
        });
      } else {
        order.status = "REJECTED";
      }
    } else if (order.type === "SELL") {
      const holding = user.holdings.find((h) => h.ticker === stock.ticker);
      if (holding && holding.shares >= order.shares) {
        holding.shares -= order.shares;
        user.cash = Number((user.cash + total).toFixed(2));
        if (holding.shares === 0) {
          user.holdings = user.holdings.filter((h) => h.ticker !== stock.ticker);
        }

        order.status = "EXECUTED";
        mockTransactions.push({
          txId: newId("t"),
          userId,
          type: "SELL",
          ticker: stock.ticker,
          shares: order.shares,
          price: stock.price,
          total,
          status: "EXECUTED",
          timestamp: nowISO(),
        });
      } else {
        order.status = "REJECTED";
      }
    }
  });

  return { message: `Executed ${pending.length} pending orders (mock)`, executedCount: pending.length };
}

/* -----------------------------
   Export for browser use
   (Attach to window so pages can call API functions)
------------------------------ */
window.TradeSmartAPI = {
  getStocks,
  buyStock,
  sellStock,
  cancelOrder,
  getPortfolio,
  getTransactions,

  depositCash,
  withdrawCash,

  adminCreateStock,
  adminUpdateMarketHours,
  adminUpdateMarketSchedule,
  executePendingOrders, // optional helper for mock execution
};