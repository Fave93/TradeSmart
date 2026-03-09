const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db: 'connected', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/stocks', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT stock_id, symbol, company_name, price FROM stocks ORDER BY symbol'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/users/:id/deposit', async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid deposit amount' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userCheck = await client.query(
      'SELECT * FROM users WHERE user_id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    await client.query(
      'UPDATE users SET cash_balance = cash_balance + $1 WHERE user_id = $2',
      [Number(amount), id]
    );

    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount)
       VALUES ($1, 'deposit', $2)`,
      [id, Number(amount)]
    );

    await client.query('COMMIT');
    res.json({ message: 'Deposit successful' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/users/:id/withdraw', async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Invalid withdrawal amount' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT cash_balance FROM users WHERE user_id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const currentBalance = Number(userResult.rows[0].cash_balance);

    if (currentBalance < Number(amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await client.query(
      'UPDATE users SET cash_balance = cash_balance - $1 WHERE user_id = $2',
      [Number(amount), id]
    );

    await client.query(
      `INSERT INTO transactions (user_id, transaction_type, amount)
       VALUES ($1, 'withdraw', $2)`,
      [id, Number(amount)]
    );

    await client.query('COMMIT');
    res.json({ message: 'Withdrawal successful' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/orders/buy', async (req, res) => {
  const { userId, ticker, shares } = req.body;

  if (!userId || !ticker || !shares || Number(shares) <= 0) {
    return res.status(400).json({ error: 'userId, ticker, and valid shares are required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT user_id, cash_balance FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const stockResult = await client.query(
      'SELECT stock_id, symbol, company_name, price FROM stocks WHERE UPPER(symbol) = UPPER($1)',
      [ticker]
    );

    if (stockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Stock not found' });
    }

    const stock = stockResult.rows[0];
    const qty = Number(shares);
    const price = Number(stock.price);
    const totalCost = qty * price;
    const currentCash = Number(userResult.rows[0].cash_balance);

    if (currentCash < totalCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    await client.query(
      'UPDATE users SET cash_balance = cash_balance - $1 WHERE user_id = $2',
      [totalCost, userId]
    );

    const holdingResult = await client.query(
      'SELECT holding_id, quantity FROM holdings WHERE user_id = $1 AND stock_id = $2',
      [userId, stock.stock_id]
    );

    if (holdingResult.rows.length === 0) {
      await client.query(
        'INSERT INTO holdings (user_id, stock_id, quantity) VALUES ($1, $2, $3)',
        [userId, stock.stock_id, qty]
      );
    } else {
      await client.query(
        'UPDATE holdings SET quantity = quantity + $1 WHERE holding_id = $2',
        [qty, holdingResult.rows[0].holding_id]
      );
    }

    await client.query(
      `INSERT INTO transactions (user_id, stock_id, transaction_type, quantity, price, amount)
       VALUES ($1, $2, 'buy', $3, $4, $5)`,
      [userId, stock.stock_id, qty, price, totalCost]
    );

    await client.query('COMMIT');

    res.json({
      message: `Buy order executed: ${qty} shares of ${stock.symbol}`,
      order: {
        type: 'BUY',
        ticker: stock.symbol,
        shares: qty,
        price,
        total: totalCost,
        status: 'EXECUTED'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/orders/sell', async (req, res) => {
  const { userId, ticker, shares } = req.body;

  if (!userId || !ticker || !shares || Number(shares) <= 0) {
    return res.status(400).json({ error: 'userId, ticker, and valid shares are required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const stockResult = await client.query(
      'SELECT stock_id, symbol, company_name, price FROM stocks WHERE UPPER(symbol) = UPPER($1)',
      [ticker]
    );

    if (stockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Stock not found' });
    }

    const stock = stockResult.rows[0];
    const qty = Number(shares);
    const price = Number(stock.price);
    const totalProceeds = qty * price;

    const holdingResult = await client.query(
      'SELECT holding_id, quantity FROM holdings WHERE user_id = $1 AND stock_id = $2',
      [userId, stock.stock_id]
    );

    if (holdingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No shares owned for this stock' });
    }

    const currentQty = Number(holdingResult.rows[0].quantity);

    if (currentQty < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough shares to sell' });
    }

    if (currentQty === qty) {
      await client.query(
        'DELETE FROM holdings WHERE holding_id = $1',
        [holdingResult.rows[0].holding_id]
      );
    } else {
      await client.query(
        'UPDATE holdings SET quantity = quantity - $1 WHERE holding_id = $2',
        [qty, holdingResult.rows[0].holding_id]
      );
    }

    await client.query(
      'UPDATE users SET cash_balance = cash_balance + $1 WHERE user_id = $2',
      [totalProceeds, userId]
    );

    await client.query(
      `INSERT INTO transactions (user_id, stock_id, transaction_type, quantity, price, amount)
       VALUES ($1, $2, 'sell', $3, $4, $5)`,
      [userId, stock.stock_id, qty, price, totalProceeds]
    );

    await client.query('COMMIT');

    res.json({
      message: `Sell order executed: ${qty} shares of ${stock.symbol}`,
      order: {
        type: 'SELL',
        ticker: stock.symbol,
        shares: qty,
        price,
        total: totalProceeds,
        status: 'EXECUTED'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/admin/stocks', async (req, res) => {
  const { companyName, ticker, initialPrice } = req.body;

  if (!companyName || !ticker || !initialPrice || Number(initialPrice) <= 0) {
    return res.status(400).json({ error: 'companyName, ticker, and valid initialPrice are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO stocks (symbol, company_name, price)
       VALUES ($1, $2, $3)
       RETURNING stock_id, symbol, company_name, price`,
      [ticker.toUpperCase(), companyName, Number(initialPrice)]
    );

    res.json({
      message: 'Stock created successfully',
      stock: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/market-hours', async (req, res) => {
  const { open, close } = req.body;

  if (!open || !close) {
    return res.status(400).json({ error: 'open and close times are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE market_config
       SET open_time = $1,
           close_time = $2
       WHERE config_id = 1
       RETURNING config_id, open_time, close_time`,
      [open, close]
    );

    res.json({
      message: 'Market hours updated successfully',
      marketHours: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/market-schedule', async (req, res) => {
  const { weekdaysOnly, closedHolidays } = req.body;

  try {
    const result = await pool.query(
      `UPDATE market_config
       SET is_weekday_only = $1,
           holidays = $2
       WHERE config_id = 1
       RETURNING config_id, is_weekday_only, holidays`,
      [Boolean(weekdaysOnly), Boolean(closedHolidays) ? 'closed' : '']
    );

    res.json({
      message: 'Market schedule updated successfully',
      marketSchedule: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/register', async (req, res) => {
  const { fullName, username, email, password } = req.body;

  if (!fullName || !username || !email || !password) {
    return res.status(400).json({ error: 'fullName, username, email, and password are required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query(
      `SELECT user_id
       FROM users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const idResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(user_id FROM 2) AS INTEGER)), 1000) + 1 AS next_id
       FROM users
       WHERE user_id ~ '^u[0-9]+$'`
    );

    const newUserId = `u${idResult.rows[0].next_id}`;

    const result = await client.query(
      `INSERT INTO users (user_id, full_name, username, email, password_hash, cash_balance)
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING user_id, full_name, username, email, cash_balance`,
      [newUserId, fullName, username, email, password]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Registration successful',
      user: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/auth/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'usernameOrEmail and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, full_name, username, email, password_hash
       FROM users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
       LIMIT 1`,
      [usernameOrEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const user = result.rows[0];

    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    res.json({
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        role: user.username.toLowerCase() === 'admin' ? 'admin' : 'customer'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/users/:id/portfolio', async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await pool.query(
      'SELECT user_id, full_name, cash_balance FROM users WHERE user_id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const holdingsResult = await pool.query(
      `SELECT h.holding_id, s.symbol, s.company_name, s.price, h.quantity,
              (s.price * h.quantity) AS total_value
       FROM holdings h
       JOIN stocks s ON h.stock_id = s.stock_id
       WHERE h.user_id = $1
       ORDER BY s.symbol`,
      [id]
    );

    res.json({
      user: userResult.rows[0],
      holdings: holdingsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/users/:id/transactions', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT t.transaction_id, t.transaction_type, t.quantity, t.price, t.amount,
              t.created_at, s.symbol
       FROM transactions t
       LEFT JOIN stocks s ON t.stock_id = s.stock_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});