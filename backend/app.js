// ============================================================
// app.js — Express app factory for local server + Vercel
// ============================================================

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const routes = require('./routes');

const app = express();

const clientOrigins = [
  ...(process.env.CLIENT_URL || 'http://localhost:3000').split(',').map(s => s.trim()).filter(Boolean),
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const corsOrigins = [...new Set(clientOrigins)];

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', message: 'FlowMind backend is running' }));

app.use('/api', routes);

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');

if (fs.existsSync(frontendDist) && fs.existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));

  // SPA fallback for local production-style runs.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    return res.sendFile(frontendIndex);
  });
}

module.exports = app;
