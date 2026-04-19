// ============================================================
// server.js — Express app entry point (merged with app.js)
// ============================================================

const mongoose = require('mongoose');

const app = require('./app');
const { startTaskScheduler } = require('./services');

const port    = process.env.PORT || 5001;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowmind';

async function startServer() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    startTaskScheduler();
    console.log('Task scheduler started');
    const server = app.listen(port, () => {
      console.log(`FlowMind backend listening on http://127.0.0.1:${port}`);
    });
    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `Port ${port} is already in use. On macOS, port 5000 is often taken by AirPlay Receiver (POSTs can get 403). Set PORT=5001 in backend/.env and VITE_BACKEND_ORIGIN=http://127.0.0.1:5001 in frontend/.env.`
        );
        process.exit(1);
      }
      throw err;
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
