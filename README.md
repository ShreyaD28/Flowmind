# FlowMind

FlowMind is an AI-assisted Gmail workflow app that turns plain-English prompts into email automations. You can connect Gmail, preview an automation from natural language, save it, run it, and inspect detailed execution logs.

## What It Does

- Connects a user's Gmail account with Google OAuth
- Converts natural-language instructions into structured workflows using Gemini
- Saves and manages automations
- Runs automations against matching Gmail messages
- Shows execution logs, analytics, and per-run details

## Core Workflow

1. Sign up or log in
2. Open `Settings` and connect Gmail
3. Go to `Create Automation`
4. Enter a prompt such as `Summarize emails daily`
5. Click `Preview Task`
6. Save the automation
7. Open `My Tasks` and run it
8. Review results in `Execution Logs`

## Main Pages

- `Create Automation`: write and preview workflows
- `My Tasks`: run, pause, edit, and delete saved automations
- `Execution Logs`: inspect successful and failed runs
- `Analytics`: review execution metrics
- `Settings`: connect Gmail and manage account preferences

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS
- Backend: Express, Mongoose, JWT auth
- AI: Gemini API
- Email: Gmail API
- Deployment: Vercel

## Local Development

### Prerequisites

- Node.js 20+
- MongoDB database
- Google Cloud OAuth credentials
- Gemini API key

### Install

```bash
npm install
```

### Environment Files

Frontend example: `frontend/.env.example`

Backend example: `backend/.env.example`

Important backend variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ENCRYPTION_KEY`

### Run Locally

```bash
npm run dev
```

Frontend runs on:

```text
http://127.0.0.1:3000
```

Backend runs on:

```text
http://127.0.0.1:5001
```

## Production

Live site:

```text
https://2026-04-18-flowmind-full-build-road.vercel.app
```

For Google OAuth in production, the OAuth client must include:

- Authorized JavaScript origin:
  `https://2026-04-18-flowmind-full-build-road.vercel.app`
- Authorized redirect URI:
  `https://2026-04-18-flowmind-full-build-road.vercel.app/api/gmail/callback`

## Notes

- Gmail access for public users requires Google verification if you want usage beyond test users.
- The current app is optimized for manual task execution from the dashboard and task list.
- Execution logs now preserve separate summaries for individual emails instead of blending them into one block.
