/*  api.js
    TradeSmart Stock Trading System (Frontend Mock API)
    - Uses mock data for now (no backend required)
    - Later: switch USE_MOCK to false and point API_BASE_URL to your server
*/

/* -----------------------------
   Configuration
------------------------------ */
const USE_MOCK = true; // ✅ keep true until backend is ready
const API_BASE_URL = "http://localhost:5000"; // change later if needed

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

/* -----------------------------
   API: Customer Functions
------------------------------ */

/**
 * getStocks()
 * Returns list of available stocks with market cap.
 */
async function getStocks() {
  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE_URL}/stocks`);
    if (!res.ok) throw new Error("Failed to fetch stocks");
    return await res.json();
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
    const res = await fetch(`${API_BASE_URL}/orders/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error("Failed to buy stock");
    return await res.json();
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
    message: "Buy order placed (PENDING)",
    order: pendingOrder,
  };
}

/**
 * sellStock(order)
 * order = { userId, ticker, shares }
 */
async function sellStock(order) {
  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE_URL}/orders/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error("Failed to sell stock");
    return await res.json();
  }

  await delay();

  const user = getUser(order.userId);
  if (!user) throw new Error("User not found");

  const stock = findStock(order.ticker);
  if (!stock) throw new Error("Stock not found");

  const shares = Number(order.shares);
  if (!Number.isFinite(shares) || shares <= 0) throw new Error("Invalid shares");

  const holding = user.holdings.find((h) => h.ticker === stock.ticker);
  if (!holding || holding.shares < shares) throw new Error("Not enough shares to sell");

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
    message: "Sell order placed (PENDING)",
    order: pendingOrder,
  };
}

/**
 * cancelOrder(orderId)
 * Cancels a pending order before it gets executed.
 */
async function cancelOrder(orderId) {
  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to cancel order");
    return await res.json();
  }

  await delay();

  const order = mockOrders.find((o) => o.orderId === orderId);
  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING") throw new Error("Only PENDING orders can be canceled");

  order.status = "CANCELED";

  // record transaction for history
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
 * Returns cash + holdings with current market value.
 */
async function getPortfolio(userId) {
  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/portfolio`);
    if (!res.ok) throw new Error("Failed to fetch portfolio");
    return await res.json();
  }

  await delay();

  const user = getUser(userId);
  if (!user) throw new Error("User not found");

  const holdings = user.holdings.map((h) => {
    const stock = findStock(h.ticker);
    const currentPrice = stock ? stock.price : 0;
    const marketValue = Number((h.shares * currentPrice).toFixed(2));
    return { ...h, currentPrice, marketValue };
  });

  const totalStockValue = Number(
    holdings.reduce((sum, h) => sum + h.marketValue, 0).toFixed(2)
  );

  return {
    userId: user.userId,
    cash: Number(user.cash.toFixed(2)),
    holdings,
    totalStockValue,
    totalAccountValue: Number((user.cash + totalStockValue).toFixed(2)),
  };
}

/**
 * getTransactions(userId)
 * Returns transaction history for user.
 */
async function getTransactions(userId) {
  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/transactions`);
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return await res.json();
  }

  await delay();
  return mockTransactions.filter((t) => t.userId === userId);
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
    const res = await fetch(`${API_BASE_URL}/admin/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stock),
    });
    if (!res.ok) throw new Error("Failed to create stock");
    return await res.json();
  }

  await delay();

  const ticker = stock.ticker.toUpperCase();
  if (findStock(ticker)) throw new Error("Ticker already exists");

  const volume = Number(stock.volume);
  const initialPrice = Number(stock.initialPrice);

  if (!Number.isFinite(volume) || volume <= 0) throw new Error("Invalid volume");
  if (!Number.isFinite(initialPrice) || initialPrice <= 0) throw new Error("Invalid initial price");

  const newStock = {
    ticker,
    companyName: stock.companyName,
    price: Number(initialPrice.toFixed(2)),
    open: Number(initialPrice.toFixed(2)),
    high: Number(initialPrice.toFixed(2)),
    low: Number(initialPrice.toFixed(2)),
    volume: Math.floor(volume),
  };

  mockStocks.push(newStock);
  return { message: "Stock created", stock: { ...newStock, marketCap: getMarketCap(newStock) } };
}

/**
 * adminUpdateMarketHours(data)
 * data = { open: "09:30", close: "16:00", timezone?: "America/New_York" }
 */
async function adminUpdateMarketHours(data) {
  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE_URL}/admin/market/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update market hours");
    return await res.json();
  }

  await delay();

  if (!data.open || !data.close) throw new Error("Open and Close times are required");
  mockMarketConfig.marketHours.open = data.open;
  mockMarketConfig.marketHours.close = data.close;
  if (data.timezone) mockMarketConfig.marketHours.timezone = data.timezone;

  return { message: "Market hours updated", marketHours: mockMarketConfig.marketHours };
}

/**
 * adminUpdateMarketSchedule(data)
 * data = { weekdaysOnly: true/false, closedHolidays: true/false }
 */
async function adminUpdateMarketSchedule(data) {
  if (!USE_MOCK) {
    const res = await fetch(`${API_BASE_URL}/admin/market/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update market schedule");
    return await res.json();
  }

  await delay();

  if (typeof data.weekdaysOnly !== "boolean") throw new Error("weekdaysOnly must be boolean");
  if (typeof data.closedHolidays !== "boolean") throw new Error("closedHolidays must be boolean");

  mockMarketConfig.marketSchedule.weekdaysOnly = data.weekdaysOnly;
  mockMarketConfig.marketSchedule.closedHolidays = data.closedHolidays;

  return { message: "Market schedule updated", marketSchedule: mockMarketConfig.marketSchedule };
}

/* -----------------------------
   Optional: Execute Pending Orders (Mock)
   Call this from UI to simulate execution.
------------------------------ */
async function executePendingOrders(userId) {
  await delay();

  const user = getUser(userId);
  if (!user) throw new Error("User not found");

  const pending = mockOrders.filter((o) => o.userId === userId && o.status === "PENDING");
  if (pending.length === 0) return { message: "No pending orders", executed: [] };

  const executed = [];

  for (const order of pending) {
    const stock = findStock(order.ticker);
    if (!stock) continue;

    const executionPrice = stock.price;
    const total = Number((order.shares * executionPrice).toFixed(2));

    if (order.type === "BUY") {
      if (user.cash >= total) {
        user.cash = Number((user.cash - total).toFixed(2));
        const holding = user.holdings.find((h) => h.ticker === stock.ticker);
        if (holding) {
          // naive avg cost update
          const newTotalShares = holding.shares + order.shares;
          const newTotalCost = holding.avgCost * holding.shares + executionPrice * order.shares;
          holding.shares = newTotalShares;
          holding.avgCost = Number((newTotalCost / newTotalShares).toFixed(2));
        } else {
          user.holdings.push({ ticker: stock.ticker, shares: order.shares, avgCost: executionPrice });
        }
        order.status = "EXECUTED";
      } else {
        order.status = "REJECTED";
      }
    }

    if (order.type === "SELL") {
      const holding = user.holdings.find((h) => h.ticker === stock.ticker);
      if (holding && holding.shares >= order.shares) {
        holding.shares -= order.shares;
        user.cash = Number((user.cash + total).toFixed(2));
        if (holding.shares === 0) {
          user.holdings = user.holdings.filter((h) => h.ticker !== stock.ticker);
        }
        order.status = "EXECUTED";
      } else {
        order.status = "REJECTED";
      }
    }

    mockTransactions.push({
      txId: newId("t"),
      userId: user.userId,
      type: order.type,
      ticker: order.ticker,
      shares: order.shares,
      price: executionPrice,
      total,
      status: order.status,
      timestamp: nowISO(),
    });

    executed.push({ ...order });
  }

  return { message: "Pending orders processed", executed };
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
  adminCreateStock,
  adminUpdateMarketHours,
  adminUpdateMarketSchedule,
  executePendingOrders, // optional helper for mock execution
};