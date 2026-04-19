const mongoose = require('mongoose');

const app = require('../backend/app');

let isConnected = false;
let schedulerStarted = false;

module.exports = async (req, res) => {
  if (!isConnected) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flowmind';
    await mongoose.connect(mongoUri);
    isConnected = true;
  }

  // Vercel serverless functions are not suitable for in-process cron scheduling.
  // Keep the API responsive and avoid spawning duplicate schedulers across invocations.
  if (!schedulerStarted) schedulerStarted = true;

  return app(req, res);
};
