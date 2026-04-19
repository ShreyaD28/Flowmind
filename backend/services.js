// ============================================================
// services.js — All services and utilities consolidated
// ============================================================

const crypto    = require('crypto');
const cron      = require('node-cron');
const { google } = require('googleapis');

const {
  User,
  getDueTasks, addTask, updateTask,
  addLog, updateLog
} = require('./models');

// ── Encryption ───────────────────────────────────────────────

class EncryptionError extends Error {
  constructor(message) { super(message); this.name = 'EncryptionError'; }
}

function getEncryptionKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new EncryptionError('ENCRYPTION_KEY is not configured');
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptValue(value) {
  if (typeof value !== 'string' || !value.length) return undefined;
  const iv       = crypto.randomBytes(12);
  const cipher   = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    iv:      iv.toString('base64'),
    content: encrypted.toString('base64'),
    tag:     cipher.getAuthTag().toString('base64')
  };
}

function decryptValue(payload) {
  if (!payload?.iv || !payload?.content || !payload?.tag) return undefined;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.content, 'base64')), decipher.final()]).toString('utf8');
}

// ── Task Schedule Helpers ────────────────────────────────────

function parseTimeString(s) {
  const m = String(s).trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return { hours: 9, minutes: 0 };
  let hours = Number(m[1]);
  const minutes  = Number(m[2] || '0');
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return { hours, minutes };
}

function getFrequencyIncrement(freq = '') {
  const n = freq.toLowerCase();
  if (n.includes('hour'))  return { hours: 1, days: 0 };
  if (n.includes('week'))  return { hours: 0, days: 7 };
  return { hours: 0, days: 1 };
}

function calculateNextRunAt(parsedTask, from = new Date()) {
  const base = new Date(from);
  const { hours, minutes } = parseTimeString(parsedTask.time);
  const inc  = getFrequencyIncrement(parsedTask.frequency);
  base.setSeconds(0, 0);
  if (inc.hours > 0) {
    base.setHours(base.getHours() + inc.hours);
  } else {
    base.setDate(base.getDate() + inc.days);
    base.setHours(hours, minutes, 0, 0);
  }
  return base.toISOString();
}

// ── Task Parser (JSON validation) ───────────────────────────

class TaskParseValidationError extends Error {
  constructor(message) { super(message); this.name = 'TaskParseValidationError'; }
}

const REQUIRED_TASK_FIELDS = ['frequency', 'time', 'source', 'action', 'condition'];

function extractJsonObject(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new TaskParseValidationError('AI returned an empty response');
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw.trim();
  const first = candidate.indexOf('{'), last = candidate.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new TaskParseValidationError('AI did not return a JSON object');
  return candidate.slice(first, last + 1);
}

function validateParsedTaskObject(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TaskParseValidationError('Parsed task must be a JSON object');
  const result = {};
  for (const field of REQUIRED_TASK_FIELDS) {
    if (typeof parsed[field] !== 'string' || !parsed[field].trim())
      throw new TaskParseValidationError(`Parsed task is missing a valid "${field}" value`);
    result[field] = parsed[field].trim();
  }
  return result;
}

function parseAndValidateTaskResponse(raw) {
  let parsed;
  try { parsed = JSON.parse(extractJsonObject(raw)); }
  catch (e) {
    if (e instanceof TaskParseValidationError) throw e;
    throw new TaskParseValidationError('AI returned invalid JSON');
  }
  return validateParsedTaskObject(parsed);
}

// ── Email Execution Parser ───────────────────────────────────

class EmailExecutionValidationError extends Error {
  constructor(message) { super(message); this.name = 'EmailExecutionValidationError'; }
}

function parseAndValidateEmailExecution(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new EmailExecutionValidationError('AI returned an empty response');
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw.trim();
  const first = candidate.indexOf('{'), last = candidate.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new EmailExecutionValidationError('AI did not return a JSON object');
  let parsed;
  try { parsed = JSON.parse(candidate.slice(first, last + 1)); }
  catch (_) { throw new EmailExecutionValidationError('AI returned invalid JSON for execution analysis'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new EmailExecutionValidationError('Execution result must be a JSON object');
  if (typeof parsed.summary !== 'string' || !parsed.summary.trim())
    throw new EmailExecutionValidationError('Execution result requires a summary');
  if (!Array.isArray(parsed.emailSummaries))
    throw new EmailExecutionValidationError('Execution result requires emailSummaries');
  if (!Array.isArray(parsed.classifications))
    throw new EmailExecutionValidationError('Execution result requires classifications');
  return {
    summary: parsed.summary.trim(),
    emailSummaries: parsed.emailSummaries.map(item => ({
      subject: String(item.subject || 'Untitled').trim(),
      from: String(item.from || '').trim(),
      summary: String(item.summary || '').trim(),
      category: String(item.category || 'General').trim(),
      reason: String(item.reason || '').trim()
    })),
    classifications: parsed.classifications.map(item => ({
      subject:  String(item.subject  || '').trim(),
      category: String(item.category || 'General').trim(),
      reason:   String(item.reason   || '').trim()
    })),
    notificationMessage: String(parsed.notificationMessage || '').trim(),
    replyDraft:          String(parsed.replyDraft          || '').trim()
  };
}

function buildFallbackExecution(task, emails) {
  const classifications = emails.map(email => ({
    subject: String(email.subject || 'Untitled').trim(),
    category: inferEmailCategory(email),
    reason: inferEmailReason(email, task)
  }));
  const emailSummaries = emails.map(email => ({
    subject: String(email.subject || 'Untitled').trim(),
    from: String(email.from || '').trim(),
    summary: inferEmailSummary(email),
    category: inferEmailCategory(email),
    reason: inferEmailReason(email, task)
  }));

  const summary = emails.length
    ? `Processed ${emails.length} email${emails.length === 1 ? '' : 's'} for "${task.commandText}".`
    : `No matching emails were found for "${task.commandText}".`;

  return {
    summary,
    emailSummaries,
    classifications,
    notificationMessage: summary,
    replyDraft: ''
  };
}

function inferEmailCategory(email) {
  const haystack = `${email.subject || ''} ${email.snippet || ''} ${email.from || ''}`.toLowerCase();
  if (haystack.includes('hr') || haystack.includes('hiring') || haystack.includes('interview')) return 'HR';
  if (haystack.includes('invoice') || haystack.includes('payment') || haystack.includes('receipt')) return 'Finance';
  if (haystack.includes('meeting') || haystack.includes('calendar') || haystack.includes('schedule')) return 'Meeting';
  if (haystack.includes('urgent') || haystack.includes('asap') || haystack.includes('action required')) return 'Urgent';
  return 'General';
}

function inferEmailReason(email, task) {
  const parts = [];
  if (email.from) parts.push(`From ${email.from}`);
  if (email.subject) parts.push(`subject "${email.subject}"`);
  if (task?.parsedTask?.condition) parts.push(`matched condition "${task.parsedTask.condition}"`);
  return parts.join(', ') || 'Matched the automation criteria.';
}

function inferEmailSummary(email) {
  const subject = String(email.subject || 'Untitled').trim();
  const sourceText = String(email.snippet || email.body || '').replace(/\s+/g, ' ').trim();
  if (!sourceText) {
    return `This email matched the workflow, but no readable preview text was available for "${subject}".`;
  }
  const preview = sourceText.length > 220 ? `${sourceText.slice(0, 217)}...` : sourceText;
  return preview;
}

function formatEmailSummaries(emailSummaries) {
  return emailSummaries.map((entry, index) => [
    `Email ${index + 1}`,
    `Subject: ${entry.subject || 'Untitled'}`,
    `From: ${entry.from || 'Unknown sender'}`,
    `Category: ${entry.category || 'General'}`,
    `Summary: ${entry.summary || 'No summary available.'}`,
    `Why it matters: ${entry.reason || 'Matched the automation criteria.'}`
  ].join('\n')).join('\n\n');
}

// ── Gemini AI Service ────────────────────────────────────────

class GeminiServiceError extends Error {
  constructor(message, statusCode = 502) {
    super(message); this.name = 'GeminiServiceError'; this.statusCode = statusCode;
  }
}

function canFallbackFromGeminiExecutionError(error) {
  if (!(error instanceof GeminiServiceError)) return false;
  if ([408, 429, 500, 502, 503, 504].includes(error.statusCode)) return true;
  const message = String(error.message || '').toLowerCase();
  return ['quota', 'rate limit', 'retry', 'temporarily unavailable', 'overloaded'].some((term) =>
    message.includes(term)
  );
}

const TASK_SYSTEM_PROMPT = `You convert plain-English automation requests into structured JSON.
Return only a JSON object with exactly these string keys:
{ "frequency": "", "time": "", "source": "", "action": "", "condition": "" }
Never add markdown, code fences, commentary, or extra keys.
If information is missing, infer a reasonable short string rather than leaving fields empty.`;

const EXECUTION_SYSTEM_PROMPT = `You help execute Gmail automations.
Return only JSON with this exact shape:
{
  "summary": "short overall summary",
  "emailSummaries": [
    {
      "subject": "...",
      "from": "...",
      "summary": "a concise summary of this single email only",
      "category": "...",
      "reason": "why this email matters or matched"
    }
  ],
  "classifications": [{ "subject": "...", "category": "...", "reason": "..." }],
  "notificationMessage": "short text if useful",
  "replyDraft": "reply if useful"
}
Do not merge multiple emails into one summary. Each entry in emailSummaries must correspond to exactly one email.
Never add markdown or extra keys.`;

async function callGemini(prompt, systemInstruction, maxTokens = 300, options = {}) {
  const key   = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  if (!key) throw new GeminiServiceError('GEMINI_API_KEY is not configured', 503);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(options.json ? { responseMimeType: 'application/json' } : {})
    }
  };

  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || 'Gemini request failed';
    throw new GeminiServiceError(msg, res.status);
  }

  return data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n').trim() || '';
}

async function parseTaskCommand(command) {
  try {
    const raw = await callGemini(`Parse this automation command: ${command}`, TASK_SYSTEM_PROMPT, 300, { json: true });
    return parseAndValidateTaskResponse(raw);
  } catch (e) {
    if (e instanceof TaskParseValidationError) throw new GeminiServiceError(`Gemini returned an invalid task schema: ${e.message}`, 502);
    throw e;
  }
}

async function analyzeEmailsForExecution(task, emails) {
  const prompt = JSON.stringify({ task: { commandText: task.commandText, parsedTask: task.parsedTask }, emails }, null, 2);
  try {
    const raw = await callGemini(prompt, EXECUTION_SYSTEM_PROMPT, 600, { json: true });
    return parseAndValidateEmailExecution(raw);
  } catch (e) {
    if (e instanceof EmailExecutionValidationError || canFallbackFromGeminiExecutionError(e)) {
      return buildFallbackExecution(task, emails);
    }
    throw e;
  }
}

// ── Gmail OAuth Service ──────────────────────────────────────

class GmailServiceError extends Error {
  constructor(message, statusCode = 502) {
    super(message); this.name = 'GmailServiceError'; this.statusCode = statusCode;
  }
}

function getGoogleRedirectUri() {
  const uri = process.env.GOOGLE_REDIRECT_URI || process.env.GMAIL_REDIRECT_URI;
  return typeof uri === 'string' ? uri.trim() : '';
}

function ensureGmailConfig() {
  const redirect = getGoogleRedirectUri();
  const missing = [];
  if (!process.env.GMAIL_CLIENT_ID) missing.push('GMAIL_CLIENT_ID');
  if (!process.env.GMAIL_CLIENT_SECRET) missing.push('GMAIL_CLIENT_SECRET');
  if (!redirect) missing.push('GOOGLE_REDIRECT_URI (or legacy GMAIL_REDIRECT_URI)');
  if (missing.length) throw new GmailServiceError(`Missing Gmail OAuth config: ${missing.join(', ')}`, 503);
}

function createOAuthClient() {
  ensureGmailConfig();
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    getGoogleRedirectUri()
  );
}

function buildGoogleAuthUrl(state) {
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline', prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    state
  });
}

async function exchangeCodeForTokens(code) {
  const { tokens } = await createOAuthClient().getToken(code);
  return tokens;
}

async function saveGmailTokensForUser(user, tokens = {}) {
  const mergedRefresh = tokens.refresh_token || decryptValue(user.gmail?.refreshToken) || process.env.GMAIL_REFRESH_TOKEN;
  user.gmail = {
    connected:    true,
    emailAddress: user.gmail?.emailAddress || null,
    accessToken:  tokens.access_token ? encryptValue(tokens.access_token) : user.gmail?.accessToken,
    refreshToken: mergedRefresh ? encryptValue(mergedRefresh) : null,
    scope:        tokens.scope       || user.gmail?.scope       || null,
    tokenType:    tokens.token_type  || user.gmail?.tokenType   || null,
    expiryDate:   tokens.expiry_date || user.gmail?.expiryDate  || null
  };
  await user.save();
  return user;
}

async function disconnectGmailForUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new GmailServiceError('User not found', 404);
  user.gmail = { connected: false, emailAddress: null, accessToken: null, refreshToken: null, scope: null, tokenType: null, expiryDate: null };
  await user.save();
}

async function getAuthorizedClient(userId) {
  const query = userId ? { _id: userId, 'gmail.connected': true } : { 'gmail.connected': true };
  const user  = await User.findOne(query);
  if (!user) throw new GmailServiceError('No connected Gmail account found', 404);
  const client = createOAuthClient();
  const refresh = decryptValue(user.gmail?.refreshToken);
  if (!refresh) throw new GmailServiceError('Gmail refresh token is not available', 401);
  client.setCredentials({ access_token: decryptValue(user.gmail?.accessToken), refresh_token: refresh, expiry_date: user.gmail?.expiryDate });
  client.on('tokens', async tokens => { try { await saveGmailTokensForUser(user, tokens); } catch (e) { console.error('Token refresh persist failed', e); } });
  return { auth: client, user };
}

function extractHeader(headers = [], name) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function decodeBody(payload) {
  if (payload?.body?.data) return Buffer.from(payload.body.data, 'base64').toString('utf8');
  if (Array.isArray(payload?.parts)) {
    for (const part of payload.parts) { const d = decodeBody(part); if (d) return d; }
  }
  return '';
}

function buildQuery(parsedTask) {
  const source  = String(parsedTask.source || '').toLowerCase();
  const cond    = parsedTask.condition || '';
  const parts   = ['in:inbox'];
  if (source.includes('unread') || cond.toLowerCase().includes('unread')) parts.push('is:unread');
  if (cond.trim()) parts.push(cond.trim());
  return parts.join(' ');
}

async function fetchEmailsForTask(parsedTask, userId, maxResults = 10) {
  const { auth } = await getAuthorizedClient(userId);
  const gmail    = google.gmail({ version: 'v1', auth });
  const list     = await gmail.users.messages.list({ userId: 'me', maxResults, q: buildQuery(parsedTask) });
  const messages = list.data.messages || [];
  return Promise.all(messages.map(async msg => {
    const detail  = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const payload = detail.data.payload || {};
    return {
      id:       msg.id,
      threadId: detail.data.threadId,
      subject:  extractHeader(payload.headers, 'Subject'),
      from:     extractHeader(payload.headers, 'From'),
      snippet:  detail.data.snippet || '',
      body:     decodeBody(payload).slice(0, 4000)
    };
  }));
}

async function fetchRecentEmails(userId, maxResults = 5) {
  return fetchEmailsForTask({ source: 'gmail inbox', condition: 'newer_than:7d' }, userId, maxResults);
}

function toBase64Url(val) {
  return Buffer.from(val).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sendEmail({ userId, to, subject, body, threadId }) {
  const { auth } = await getAuthorizedClient(userId);
  const gmail    = google.gmail({ version: 'v1', auth });
  const raw      = toBase64Url(`To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`);
  return gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId } });
}

async function getPrimaryEmailAddress(userId) {
  const { auth, user } = await getAuthorizedClient(userId);
  if (user.gmail?.emailAddress) return user.gmail.emailAddress;
  const gmail   = google.gmail({ version: 'v1', auth });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  if (profile.data.emailAddress && user.gmail?.emailAddress !== profile.data.emailAddress) {
    user.gmail.emailAddress = profile.data.emailAddress;
    await user.save();
  }
  return profile.data.emailAddress;
}

// ── Task Execution Engine ────────────────────────────────────

let isRunning = false;

async function performTaskAction(task, emails, analysis) {
  const action = String(task.parsedTask.action || '').toLowerCase();
  if (action.includes('notify')) {
    const to = process.env.NOTIFICATION_EMAIL || (await getPrimaryEmailAddress(task.userId));
    await sendEmail({ userId: task.userId, to, subject: `FlowMind notification: ${task.commandText}`, body: analysis.notificationMessage || analysis.summary });
    return `Sent notification to ${to}.`;
  }
  if (action.includes('reply')) {
    const target = emails[0];
    if (!target) return 'No email available to reply to.';
    await sendEmail({ userId: task.userId, to: target.from, subject: `Re: ${target.subject || task.commandText}`, body: analysis.replyDraft || analysis.summary, threadId: target.threadId });
    return `Sent reply to ${target.from}.`;
  }
  if (action.includes('summarize'))  return 'Generated summary for the fetched emails.';
  if (action.includes('classify'))   return 'Classified fetched emails into structured categories.';
  return `Processed action "${task.parsedTask.action}".`;
}

async function executeTask(task) {
  const startedAt = Date.now();
  const logEntry  = await addLog({
    id: `log-${Date.now()}`, userId: task.userId, title: `${task.commandText} is running`, status: 'Running',
    executedAt: new Date().toISOString(), automationName: task.commandText,
    emailsProcessed: 0, durationMs: 0,
    summary: 'Execution started.', details: 'Fetching Gmail messages and sending them to Gemini for analysis.'
  });
  try {
    const emails   = await fetchEmailsForTask(task.parsedTask, task.userId);
    if (!emails.length) {
      await updateTask(task.id, { status: 'Active', lastRunAt: new Date().toISOString(), nextRunAt: calculateNextRunAt(task.parsedTask) });
      await updateLog(logEntry.id, {
        title: `${task.commandText} completed`,
        status: 'Success',
        emailsProcessed: 0,
        durationMs: Date.now() - startedAt,
        summary: `No matching emails were found for "${task.commandText}".`,
        details: 'The workflow completed successfully, but there were no emails matching the current Gmail query.'
      });
      return;
    }
    const analysis = await analyzeEmailsForExecution(task, emails);
    const detail   = await performTaskAction(task, emails, analysis);
    await updateTask(task.id, { status: 'Active', lastRunAt: new Date().toISOString(), nextRunAt: calculateNextRunAt(task.parsedTask) });
    await updateLog(logEntry.id, {
      title: `${task.commandText} completed`, status: 'Success',
      emailsProcessed: emails.length, durationMs: Date.now() - startedAt,
      summary: analysis.summary,
      details: `${detail}\n\nIndividual email summaries:\n\n${formatEmailSummaries(analysis.emailSummaries)}`
    });
  } catch (error) {
    await updateTask(task.id, { status: 'Failed', lastRunAt: new Date().toISOString(), nextRunAt: calculateNextRunAt(task.parsedTask) });
    await updateLog(logEntry.id, {
      title: `${task.commandText} failed`, status: 'Failed',
      durationMs: Date.now() - startedAt,
      summary: 'Execution failed before the workflow could complete.',
      details: 'The execution engine encountered an error while processing the task.',
      errorMessage: error.message
    });
    if (!(error instanceof GmailServiceError)) console.error(`Task execution failed for ${task.id}`, error);
  }
}

async function runDueTasks() {
  if (isRunning) return;
  isRunning = true;
  try {
    const due = await getDueTasks(new Date());
    for (const task of due) await executeTask(task);
  } finally {
    isRunning = false;
  }
}

function startTaskScheduler() {
  return cron.schedule('* * * * *', runDueTasks);
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  // encryption
  encryptValue, decryptValue,
  // schedule
  calculateNextRunAt,
  // AI (gemini)
  GeminiServiceError, parseTaskCommand, analyzeEmailsForExecution,
  TaskParseValidationError, validateParsedTaskObject,
  // gmail
  GmailServiceError, buildGoogleAuthUrl, exchangeCodeForTokens,
  saveGmailTokensForUser, disconnectGmailForUser,
  fetchEmailsForTask, fetchRecentEmails,
  getPrimaryEmailAddress, sendEmail,
  // engine
  runDueTasks, executeTask,
  // scheduler
  startTaskScheduler
};
