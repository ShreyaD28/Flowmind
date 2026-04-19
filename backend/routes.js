// ============================================================
// routes.js — All routes, controllers, and auth middleware
// ============================================================

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const { User, getTasks, getTaskById, addTask, updateTask, deleteTask, getLogs, getMetrics } = require('./models');
const {
  GeminiServiceError, GmailServiceError, TaskParseValidationError,
  parseTaskCommand, calculateNextRunAt, validateParsedTaskObject,
  buildGoogleAuthUrl, exchangeCodeForTokens,
  saveGmailTokensForUser, disconnectGmailForUser, fetchRecentEmails,
  executeTask
} = require('./services');

const router = express.Router();
const JWT_SECRET = () => process.env.JWT_SECRET || 'development-secret';

// ── Auth Middleware ──────────────────────────────────────────

async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ message: 'Not authorized' });
  try {
    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET());
    const user    = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (_) {
    return res.status(401).json({ message: 'Token is invalid' });
  }
}

// ── Auth Helpers ─────────────────────────────────────────────

function createToken(userId) {
  const id = userId && typeof userId.toString === 'function' ? userId.toString() : String(userId);
  return jwt.sign({ userId: id }, JWT_SECRET(), { expiresIn: '7d' });
}

function sanitizeUser(user) {
  const n = user.notifications || {};
  return {
    id:             String(user._id),
    name:           user.name,
    email:          user.email,
    gmailConnected: user.gmail?.connected ?? false,
    timezone:       user.timezone || 'Asia/Kolkata',
    jobTitle:       user.jobTitle || '',
    notifications: {
      emailSummaries:    n.emailSummaries !== false,
      executionFailures: n.executionFailures !== false,
      weeklyInsights:    Boolean(n.weeklyInsights)
    }
  };
}

// ── Auth Routes ──────────────────────────────────────────────

router.post('/auth/register', async (req, res) => {
  try {
    const raw = req.body || {};
    const name     = typeof raw.name === 'string' ? raw.name.trim() : '';
    const email    = typeof raw.email === 'string' ? raw.email.trim() : '';
    const password = typeof raw.password === 'string' ? raw.password : '';
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email, and password are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ message: 'User already exists' });
    const user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 10) });
    return res.status(201).json({ token: createToken(user._id), user: sanitizeUser(user) });
  } catch (e) {
    console.error('Register error', e);
    if (e.code === 11000)
      return res.status(409).json({ message: 'User already exists' });
    if (e.name === 'ValidationError') {
      const msg = Object.values(e.errors || {}).map(err => err.message).join(' ');
      return res.status(400).json({ message: msg || 'Invalid registration data' });
    }
    const expose = process.env.NODE_ENV !== 'production' && e.message;
    return res.status(500).json({ message: expose || 'Unable to register user' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const raw = req.body || {};
    const email    = typeof raw.email === 'string' ? raw.email.trim() : '';
    const password = typeof raw.password === 'string' ? raw.password : '';
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    return res.json({ token: createToken(user._id), user: sanitizeUser(user) });
  } catch (e) {
    console.error('Login error', e);
    const expose = process.env.NODE_ENV !== 'production' && e.message;
    return res.status(500).json({ message: expose || 'Unable to log in' });
  }
});

router.get('/auth/me', protect, (req, res) => res.json({ user: sanitizeUser(req.user) }));

router.patch('/auth/profile', protect, async (req, res) => {
  try {
    const { name, timezone, jobTitle, notifications } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim())
        return res.status(400).json({ message: 'Name must be a non-empty string' });
      req.user.name = name.trim();
    }
    if (timezone !== undefined) {
      if (typeof timezone !== 'string' || !timezone.trim())
        return res.status(400).json({ message: 'Timezone must be a non-empty string' });
      req.user.timezone = timezone.trim();
    }
    if (jobTitle !== undefined) {
      if (typeof jobTitle !== 'string') return res.status(400).json({ message: 'Invalid job title' });
      req.user.jobTitle = jobTitle.trim();
    }
    if (notifications && typeof notifications === 'object') {
      req.user.notifications = req.user.notifications || {};
      for (const k of ['emailSummaries', 'executionFailures', 'weeklyInsights']) {
        if (typeof notifications[k] === 'boolean') req.user.notifications[k] = notifications[k];
      }
    }
    await req.user.save();
    const fresh = await User.findById(req.user._id).select('-password');
    return res.json({ user: sanitizeUser(fresh) });
  } catch (_) {
    return res.status(500).json({ message: 'Unable to update profile' });
  }
});

// ── Task Routes ──────────────────────────────────────────────

router.get('/tasks', protect, async (req, res) => {
  try {
    const tasks = await getTasks(req.user.id);
    return res.json({ tasks });
  } catch (_) {
    return res.status(500).json({ message: 'Unable to load tasks' });
  }
});

router.post('/tasks/preview', protect, async (req, res) => {
  const { command } = req.body;
  if (typeof command !== 'string' || !command.trim())
    return res.status(400).json({ message: 'A plain English command is required' });
  try {
    const parsedTask = await parseTaskCommand(command.trim());
    return res.json({ parsedTask });
  } catch (e) {
    if (e instanceof GeminiServiceError) return res.status(e.statusCode).json({ message: e.message });
    return res.status(500).json({ message: 'Unable to preview task command' });
  }
});

router.post('/tasks/parse', protect, async (req, res) => {
  const { command, parsedTask: clientParsed } = req.body;
  if (typeof command !== 'string' || !command.trim())
    return res.status(400).json({ message: 'A plain English command is required' });
  try {
    let parsedTask;
    if (clientParsed && typeof clientParsed === 'object') {
      try { parsedTask = validateParsedTaskObject(clientParsed); }
      catch (e) {
        if (e instanceof TaskParseValidationError)
          return res.status(400).json({ message: e.message });
        throw e;
      }
    } else {
      parsedTask = await parseTaskCommand(command.trim());
    }
    const saved = await addTask({
      id:          `task-${Date.now()}`,
      userId:      req.user._id,
      commandText: command.trim(),
      status:      'Active',
      nextRunAt:   calculateNextRunAt(parsedTask),
      lastRunAt:   new Date().toISOString(),
      parsedTask
    });
    return res.status(201).json({ message: 'Task parsed and saved successfully', task: saved });
  } catch (e) {
    if (e instanceof GeminiServiceError) return res.status(e.statusCode).json({ message: e.message });
    return res.status(500).json({ message: 'Unable to parse task command' });
  }
});

router.post('/tasks/:taskId/run', protect, async (req, res) => {
  const task = await getTaskById(req.params.taskId);
  if (!task || String(task.userId) !== String(req.user._id))
    return res.status(404).json({ message: 'Task not found' });
  try {
    await executeTask(task);
    const updated = await getTaskById(req.params.taskId);
    return res.json({ message: 'Task executed', task: updated });
  } catch (e) {
    console.error('Run task failed', e);
    return res.status(500).json({ message: 'Unable to run task' });
  }
});

router.patch('/tasks/:taskId', protect, async (req, res) => {
  const task = await getTaskById(req.params.taskId);
  if (!task || String(task.userId) !== String(req.user._id))
    return res.status(404).json({ message: 'Task not found' });
  const { commandText, status } = req.body;
  const updates = {};
  if (typeof commandText === 'string' && commandText.trim()) updates.commandText = commandText.trim();
  if (status === 'Active' || status === 'Paused' || status === 'Failed') updates.status = status;
  if (!Object.keys(updates).length)
    return res.status(400).json({ message: 'No valid updates supplied' });
  const updated = await updateTask(req.params.taskId, updates);
  if (!updated) return res.status(404).json({ message: 'Task not found' });
  return res.json({ task: updated });
});

router.delete('/tasks/:taskId', protect, async (req, res) => {
  const ok = await deleteTask(req.params.taskId, req.user.id);
  if (!ok) return res.status(404).json({ message: 'Task not found' });
  return res.json({ message: 'Task deleted' });
});

// ── Log Routes ───────────────────────────────────────────────

router.get('/logs', protect, async (req, res) => {
  try {
    const [metrics, logs] = await Promise.all([getMetrics(req.user.id), getLogs(req.user.id)]);
    return res.json({ metrics, logs });
  } catch (_) {
    return res.status(500).json({ message: 'Unable to load logs' });
  }
});

// ── Gmail Routes ─────────────────────────────────────────────

function buildStateToken(userId) {
  return jwt.sign({ userId, provider: 'gmail' }, JWT_SECRET(), { expiresIn: '15m' });
}

function getClientRedirectUrl(status) {
  return `${process.env.CLIENT_URL || 'http://localhost:3000'}/app/settings?gmail=${status}`;
}

function handleGmailError(res, error) {
  if (error instanceof GmailServiceError) return res.status(error.statusCode).json({ message: error.message });
  return res.status(500).json({ message: 'Unable to complete Gmail OAuth request' });
}

// Return the Google OAuth URL as JSON so the frontend can redirect
// (browser redirects can't send Authorization headers)
router.get('/gmail/authurl', protect, (req, res) => {
  try {
    const authUrl = buildGoogleAuthUrl(buildStateToken(req.user.id));
    return res.json({ authUrl });
  } catch (e) { return handleGmailError(res, e); }
});

router.get('/gmail/callback', async (req, res) => {
  const { code, state, error: providerError } = req.query;
  if (providerError) return res.redirect(getClientRedirectUrl('error'));
  if (!code || !state) return res.status(400).json({ message: 'Missing Google OAuth callback parameters' });
  try {
    const decoded = jwt.verify(state, JWT_SECRET());
    const user    = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found for Gmail OAuth callback' });
    const tokens  = await exchangeCodeForTokens(code);
    await saveGmailTokensForUser(user, tokens);
    return res.redirect(getClientRedirectUrl('connected'));
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError')
      return res.status(400).json({ message: 'Invalid Gmail OAuth state' });
    return handleGmailError(res, e);
  }
});

router.get('/gmail/test', protect, async (req, res) => {
  try {
    const emails = await fetchRecentEmails(req.user.id, 5);
    return res.json({ emails });
  } catch (e) { return handleGmailError(res, e); }
});

router.delete('/gmail/disconnect', protect, async (req, res) => {
  try {
    await disconnectGmailForUser(req.user.id);
    return res.json({ message: 'Gmail disconnected successfully' });
  } catch (e) { return handleGmailError(res, e); }
});

module.exports = router;
