require('dotenv').config();


async function fetchAddressData(address) {
  const url = `https://api.blockchair.com/zcash/dashboards/address/${address}?transactions=true`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  const data = await response.json();
  return data;
}

async function fetchWalletInfo(addresses) {
  const results = [];
  let total_balance = 0;
  let total_received = 0;
  let total_sent = 0;

  for (const addr of addresses) {
    try {
      const data = await fetchAddressData(addr);
      const info = data.data[addr].address;

      const balance = info.balance / 1e8;
      const received = info.received / 1e8;
      const sent = info.sent / 1e8;
      const transactions = data.data[addr].transactions.slice(0, 10);

      total_balance += balance;
      total_received += received;
      total_sent += sent;

      results.push({
        address: addr,
        balance,
        total_received: received,
        total_sent: sent,
        transactions
      });
    } catch (error) {
      results.push({
        address: addr,
        error: error.message
      });
    }
  }

  return {
    addresses: results,
    totals: {
      balance: total_balance,
      total_received: total_received,
      total_sent: total_sent
    }
  };
}



const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ZDA Funding Wallet API',
    version: '1.0.0',
    description: 'API for managing cards, milestones, and funding',
  },
  servers: [
    { url: 'https://zdabe.onrender.com' }
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./server.js'], // We'll add swagger comments here
};

const swaggerSpec = swaggerJSDoc(options);

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

/**
 * @swagger
 * /api/v1/exchange-rate:
 *   get:
 *     summary: Get the current ZEC to USD exchange rate
 *     responses:
 *       200:
 *         description: Exchange rate data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 zec_to_usd:
 *                   type: number
 *                   description: The current exchange rate from ZEC to USD
 *                   example: 72.55
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp of the exchange rate
 *                   example: "2025-07-01T12:00:00.000Z"
 */

app.get('/api/v1/exchange-rate', (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  res.json({
    zec_to_usd: 72.55,
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/v1/cards:
 *   get:
 *     summary: Get a list of cards with pagination and filters
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *         description: Number of cards per page (default 10)
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *         description: Filter by priority
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by card status
 *       - in: query
 *         name: stage
 *         schema:
 *           type: string
 *         description: Filter by card stage
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags
 *     responses:
 *       200:
 *         description: A paginated list of cards
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *                 cards:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                       stage:
 *                         type: string
 *                       stage_funding:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             stage:
 *                               type: string
 *                             funding_requested:
 *                               type: string
 *                       total_funding_requested:
 *                         type: string
 */

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


/**
 * @swagger
 * /api/v1/cards/{id}:
 *   get:
 *     summary: Get details of a single card by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the card
 *     responses:
 *       200:
 *         description: Card details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 creators:
 *                   type: array
 *                   items:
 *                     type: string
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 contributors:
 *                   type: integer
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 priority:
 *                   type: string
 *                 funding_earned:
 *                   type: string
 *                 funding_spent:
 *                   type: string
 *                 funding_requested:
 *                   type: string
 *                 funding_received:
 *                   type: string
 *                 funding_available:
 *                   type: string
 *                 percent_funded:
 *                   type: string
 *                 visibility:
 *                   type: string
 *                 milestones:
 *                   type: array
 *                   items:
 *                     type: object
 *                 status:
 *                   type: string
 *                 stage:
 *                   type: string
 *                 created_by:
 *                   type: string
 *                 owned_by:
 *                   type: string
 *                 last_updated:
 *                   type: string
 *                   format: date-time
 *                 wallet_addresses:
 *                   type: array
 *                   items:
 *                     type: string
 *                 view_keys:
 *                   type: array
 *                   items:
 *                     type: string
 *       404:
 *         description: Card not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Not Found
 */
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

    const card = result.rows[0];

    if (card.wallet_addresses && card.wallet_addresses.length > 0) {
      try {
        const walletInfo = await fetchWalletInfo(card.wallet_addresses);
        res.json({ ...card, wallet_info: walletInfo });
      } catch (err) {
        console.error('Error fetching wallet info:', err);
        // Send card data anyway, with a note about wallet info failure
        res.json({ ...card, wallet_info_error: 'Failed to retrieve wallet info' });
      }
    } else {
      res.json(card);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/**
 * @swagger
 * /api/v1/funding-summary:
 *   get:
 *     summary: Get aggregated funding summary across all public cards
 *     responses:
 *       200:
 *         description: Aggregated funding data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_earned:
 *                   type: string
 *                   description: Total funding earned
 *                 total_spent:
 *                   type: string
 *                   description: Total funding spent
 *                 total_requested:
 *                   type: string
 *                   description: Total funding requested
 *                 total_received:
 *                   type: string
 *                   description: Total funding received
 *                 total_available:
 *                   type: string
 *                   description: Total funding available
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */

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

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
