require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { Pool } = require('pg');

// Replace this with your actual Supabase connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


pool.connect()
  .then(() => console.log('Connected to the database'))
  .catch(err => console.error('Database connection error:', err.stack));

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());

// Rate limiter: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

app.use((req, res, next) => {
  res.set('X-API-Version', 'v1');
  next();
});


// Simple test route
app.get('/', (req, res) => {
  res.send('ZDA Funding Wallet API v1 is running');
});

app.get('/api/v1/exchange-rate', (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  res.json({
    zec_to_usd: 72.55,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/cards', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');

  const {
    page = 1,
    per_page = 10,
    sort_by = 'last_updated',
    sort_dir = 'desc'
  } = req.query;

  const limit = Math.min(parseInt(per_page, 10) || 10, 100);
  const offset = (parseInt(page, 10) - 1) * limit;
  const validSortBy = ['last_updated', 'priority', 'percent_funded', 'date'];
  const validSortDir = ['asc', 'desc'];

  const sortBySafe = validSortBy.includes(sort_by) ? sort_by : 'last_updated';
  const sortDirSafe = validSortDir.includes(sort_dir) ? sort_dir : 'desc';

  const conditions = [`visibility = 'PUBLIC'`];
  const values = [];
  let idx = 1;

  if (req.query.priority) {
    conditions.push(`priority = $${idx++}`);
    values.push(req.query.priority);
  }
  if (req.query.status) {
    conditions.push(`status = $${idx++}`);
    values.push(req.query.status);
  }
  if (req.query.stage) {
    conditions.push(`stage = $${idx++}`);
    values.push(req.query.stage);
  }
  if (req.query.tags) {
    conditions.push(`tags && string_to_array($${idx++}, ',')`);
    values.push(req.query.tags);
  }

  const whereClause = conditions.join(' AND ');

  try {
    const totalResult = await pool.query(
      `SELECT COUNT(*) FROM cards WHERE ${whereClause}`,
      values
    );
    const totalRows = parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRows / limit);

    const result = await pool.query(
      `SELECT * FROM cards WHERE ${whereClause} ORDER BY ${sortBySafe} ${sortDirSafe} LIMIT $${idx++} OFFSET $${idx}`,
      [...values, limit, offset]
    );

    const stageFundingResult = await pool.query(`
      SELECT card_id, stage, funding_requested
      FROM card_stage_funding
    `);

    const stageFundingMap = {};
    for (const row of stageFundingResult.rows) {
      if (!stageFundingMap[row.card_id]) {
        stageFundingMap[row.card_id] = [];
      }
      stageFundingMap[row.card_id].push({
        stage: row.stage,
        funding_requested: row.funding_requested,
        currency: row.currency || 'ZEC',
        note: row.note || null
      });

    }

    // Attach stage_funding and total_stage_funding_requested to each card
  const cardsWithFunding = result.rows.map(card => {
  const stageEntries = stageFundingMap[card.id] || [];
  const totalRequested = stageEntries.reduce(
    (sum, s) => sum + parseFloat(s.funding_requested || 0), 0
  ).toFixed(8);

  return {
    ...card,
    stage_funding: stageEntries,
    total_funding_requested: totalRequested
  };
});


    res.json({
      pagination: {
        current_page: parseInt(page, 10),
        per_page: limit,
        total_pages: totalPages
      },
      cards: cardsWithFunding
    });
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/cards/:id', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');

  try {
    const result = await pool.query(
      `SELECT * FROM cards WHERE id = $1 AND visibility = 'PUBLIC'`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/api/v1/funding-summary', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  try {
    const result = await pool.query(`
      SELECT
        SUM(funding_earned)::text AS total_earned,
        SUM(funding_spent)::text AS total_spent,
        SUM(funding_requested)::text AS total_requested,
        SUM(funding_received)::text AS total_received,
        SUM(funding_available)::text AS total_available
      FROM cards
      WHERE visibility = 'PUBLIC'
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Summary query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
