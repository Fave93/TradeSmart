const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;
const USE_MOCK = window.APP_CONFIG.USE_MOCK;

async function handleResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data;
}

async function getStocks() {
  if (USE_MOCK) return [];
  const res = await fetch(`${API_BASE_URL}/stocks`);
  return handleResponse(res);
}

async function getPortfolio(userId) {
  if (USE_MOCK) return { user: {}, holdings: [] };
  const res = await fetch(`${API_BASE_URL}/users/${userId}/portfolio`);
  return handleResponse(res);
}

async function getTransactions(userId) {
  if (USE_MOCK) return [];
  const res = await fetch(`${API_BASE_URL}/users/${userId}/transactions`);
  return handleResponse(res);
}

async function depositCash({ userId, amount }) {
  if (USE_MOCK) return { message: 'Mock deposit successful' };

  const res = await fetch(`${API_BASE_URL}/users/${userId}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Number(amount) })
  });

  return handleResponse(res);
}

async function withdrawCash({ userId, amount }) {
  if (USE_MOCK) return { message: 'Mock withdrawal successful' };

  const res = await fetch(`${API_BASE_URL}/users/${userId}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: Number(amount) })
  });

  return handleResponse(res);
}

async function buyStock({ userId, ticker, shares }) {
  if (USE_MOCK) return { message: 'Mock buy successful' };

  const res = await fetch(`${API_BASE_URL}/orders/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ticker, shares: Number(shares) })
  });

  return handleResponse(res);
}

async function sellStock({ userId, ticker, shares }) {
  if (USE_MOCK) return { message: 'Mock sell successful' };

  const res = await fetch(`${API_BASE_URL}/orders/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ticker, shares: Number(shares) })
  });

  return handleResponse(res);
}

async function adminCreateStock({ companyName, ticker, initialPrice }) {
  if (USE_MOCK) return { message: 'Mock stock created' };

  const res = await fetch(`${API_BASE_URL}/admin/stocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName,
      ticker,
      initialPrice: Number(initialPrice)
    })
  });

  return handleResponse(res);
}

async function adminUpdateMarketHours({ open, close }) {
  if (USE_MOCK) return { message: 'Mock market hours updated' };

  const res = await fetch(`${API_BASE_URL}/admin/market-hours`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ open, close })
  });

  return handleResponse(res);
}

async function adminUpdateMarketSchedule({ weekdaysOnly, closedHolidays }) {
  if (USE_MOCK) return { message: 'Mock market schedule updated' };

  const res = await fetch(`${API_BASE_URL}/admin/market-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekdaysOnly, closedHolidays })
  });

  return handleResponse(res);
}

async function registerUser({ fullName, username, email, password }) {
  if (USE_MOCK) {
    return {
      message: 'Mock registration successful',
      user: {
        user_id: 'u1002',
        full_name: fullName,
        username,
        email,
        role: 'customer'
      }
    };
  }

  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, username, email, password })
  });

  return handleResponse(res);
}

async function loginUser({ usernameOrEmail, password }) {
  if (USE_MOCK) {
    return {
      message: 'Mock login successful',
      user: {
        user_id: 'u1001',
        full_name: 'Demo User',
        username: 'demo',
        email: 'demo@example.com',
        role: 'customer'
      }
    };
  }

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password })
  });

  return handleResponse(res);
}

window.API = {
  getStocks,
  getPortfolio,
  getTransactions,
  depositCash,
  withdrawCash,
  buyStock,
  sellStock,
  adminCreateStock,
  adminUpdateMarketHours,
  adminUpdateMarketSchedule,
  registerUser,
  loginUser
};