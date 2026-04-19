// ============================================================
// models.js — Mongoose schemas + Task / ExecutionLog stores
// ============================================================

const mongoose = require('mongoose');

// ── User Schema ─────────────────────────────────────────────

const encryptedValueSchema = new mongoose.Schema(
  { iv: String, content: String, tag: String },
  { _id: false }
);

const gmailSchema = new mongoose.Schema(
  {
    connected:    { type: Boolean, default: false },
    emailAddress: { type: String,  default: null },
    accessToken:  { type: encryptedValueSchema, default: null },
    refreshToken: { type: encryptedValueSchema, default: null },
    scope:        { type: String,  default: null },
    tokenType:    { type: String,  default: null },
    expiryDate:   { type: Number,  default: null }
  },
  { _id: false }
);

const notificationsSchema = new mongoose.Schema(
  {
    emailSummaries:    { type: Boolean, default: true },
    executionFailures: { type: Boolean, default: true },
    weeklyInsights:    { type: Boolean, default: false }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:      { type: String, required: true },
    gmail:         { type: gmailSchema, default: () => ({}) },
    timezone:      { type: String, default: 'Asia/Kolkata', trim: true },
    jobTitle:      { type: String, default: '', trim: true },
    notifications: { type: notificationsSchema, default: () => ({}) }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

// ── Task Schema (persisted) ───────────────────────────────────

const taskSchema = new mongoose.Schema(
  {
    taskKey:     { type: String, required: true, unique: true, index: true },
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    commandText: { type: String, required: true, trim: true },
    status:      { type: String, enum: ['Active', 'Paused', 'Failed'], default: 'Active', index: true },
    nextRunAt:   { type: Date, required: true, index: true },
    lastRunAt:   { type: Date, required: true },
    parsedTask:  { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

const Task = mongoose.model('Task', taskSchema);

function serializeTask(doc) {
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id:          row.taskKey,
    userId:      String(row.userId),
    commandText: row.commandText,
    status:      row.status,
    nextRunAt:   (row.nextRunAt instanceof Date ? row.nextRunAt : new Date(row.nextRunAt)).toISOString(),
    lastRunAt:   (row.lastRunAt instanceof Date ? row.lastRunAt : new Date(row.lastRunAt)).toISOString(),
    parsedTask:  row.parsedTask
  };
}

async function getTasks(userId) {
  const rows = await Task.find({ userId }).sort({ updatedAt: -1 }).lean();
  return rows.map(r => serializeTask(r));
}

async function getTaskById(taskKey) {
  const row = await Task.findOne({ taskKey }).lean();
  return row ? serializeTask(row) : null;
}

async function addTask(task) {
  const doc = await Task.create({
    taskKey:     task.id,
    userId:      task.userId,
    commandText: task.commandText,
    status:      task.status,
    nextRunAt:   new Date(task.nextRunAt),
    lastRunAt:   new Date(task.lastRunAt),
    parsedTask:  task.parsedTask
  });
  return serializeTask(doc);
}

async function getDueTasks(now = new Date()) {
  return Task.find({
    status:    'Active',
    nextRunAt: { $lte: now }
  }).lean();
}

async function updateTask(taskKey, updates) {
  const set = {};
  if (updates.commandText !== undefined) set.commandText = updates.commandText;
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.nextRunAt !== undefined) set.nextRunAt = new Date(updates.nextRunAt);
  if (updates.lastRunAt !== undefined) set.lastRunAt = new Date(updates.lastRunAt);
  if (updates.parsedTask !== undefined) set.parsedTask = updates.parsedTask;
  if (!Object.keys(set).length) return getTaskById(taskKey);
  const doc = await Task.findOneAndUpdate({ taskKey }, { $set: set }, { new: true }).lean();
  return doc ? serializeTask(doc) : null;
}

async function deleteTask(taskKey, userId) {
  const res = await Task.deleteOne({ taskKey, userId });
  return res.deletedCount > 0;
}

// ── Execution Log Schema ────────────────────────────────────

const executionLogSchema = new mongoose.Schema(
  {
    logKey:          { type: String, required: true, unique: true, index: true },
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:           { type: String, required: true },
    status:          { type: String, enum: ['Running', 'Success', 'Failed'], required: true, index: true },
    executedAt:      { type: Date, required: true },
    automationName:  { type: String, default: '' },
    emailsProcessed: { type: Number, default: 0 },
    durationMs:      { type: Number, default: 0 },
    summary:         { type: String, default: '' },
    details:         { type: String, default: '' },
    errorMessage:    { type: String, default: '' }
  },
  { timestamps: true }
);

const ExecutionLog = mongoose.model('ExecutionLog', executionLogSchema);

function serializeLog(doc) {
  const row = doc.toObject ? doc.toObject() : doc;
  return {
    id:              row.logKey,
    userId:          String(row.userId),
    title:           row.title,
    status:          row.status,
    executedAt:      (row.executedAt instanceof Date ? row.executedAt : new Date(row.executedAt)).toISOString(),
    automationName:  row.automationName,
    emailsProcessed: row.emailsProcessed,
    durationMs:      row.durationMs,
    summary:         row.summary,
    details:         row.details,
    errorMessage:    row.errorMessage || ''
  };
}

async function getLogs(userId) {
  const rows = await ExecutionLog.find({ userId }).sort({ executedAt: -1 }).lean();
  return rows.map(r => serializeLog(r));
}

async function addLog(log) {
  const doc = await ExecutionLog.create({
    logKey:          log.id,
    userId:          log.userId,
    title:           log.title,
    status:          log.status,
    executedAt:      new Date(log.executedAt),
    automationName:  log.automationName,
    emailsProcessed: log.emailsProcessed || 0,
    durationMs:      log.durationMs || 0,
    summary:         log.summary || '',
    details:         log.details || '',
    errorMessage:    log.errorMessage || ''
  });
  return serializeLog(doc);
}

async function updateLog(logKey, updates) {
  const set = {};
  for (const k of ['title', 'status', 'emailsProcessed', 'durationMs', 'summary', 'details', 'errorMessage'])
    if (updates[k] !== undefined) set[k] = updates[k];
  if (!Object.keys(set).length) return null;
  const doc = await ExecutionLog.findOneAndUpdate({ logKey }, { $set: set }, { new: true }).lean();
  return doc ? serializeLog(doc) : null;
}

async function getMetrics(userId) {
  const userLogs = await ExecutionLog.find({ userId }).lean();
  const total   = userLogs.length;
  const success = userLogs.filter(l => l.status === 'Success').length;
  return {
    totalExecutions:  total,
    successRate:      total === 0 ? 0 : Math.round((success / total) * 100),
    emailsProcessed:  userLogs.reduce((n, l) => n + (l.emailsProcessed || 0), 0)
  };
}

module.exports = {
  User,
  Task,
  ExecutionLog,
  getTasks, getTaskById, addTask, getDueTasks, updateTask, deleteTask,
  getLogs, addLog, updateLog, getMetrics,
  serializeTask
};
