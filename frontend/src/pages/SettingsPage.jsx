// ============================================================
// SettingsPage.jsx — Workspace settings, wired to real APIs
// ============================================================

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell, SkeletonBlock } from '../App';
import { useAuth, useToast } from '../AuthContext';
import { getGmailAuthUrl, disconnectGmail } from '../api';

const timezoneOptions = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'UTC'
];

function ToggleRow({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4 transition hover:bg-slate-100">
      <div>
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <p className="mt-1 text-sm leading-7 text-slate-500">{description}</p>
      </div>
      <button
        aria-pressed={checked}
        className={['relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-slate-300', disabled ? 'cursor-not-allowed opacity-50' : ''].join(' ')}
        disabled={disabled}
        onClick={onChange}
        type="button"
      >
        <span className={['absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all', checked ? 'left-6' : 'left-1'].join(' ')} />
      </button>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <article key={i} className="card-lift rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="mt-4 h-7 w-48" />
          <SkeletonBlock className="mt-3 h-4 w-full" />
          <SkeletonBlock className="mt-8 h-28 w-full" />
        </article>
      ))}
    </section>
  );
}

function SettingsPage() {
  const { user, token, isLoading: authLoading, refreshUser, saveProfile } = useAuth();
  const { toastSuccess, toastError }             = useToast();
  const location = useLocation();

  // ── Gmail state — seeded from real user profile ──────────────
  const [gmailConnected, setGmailConnected] = useState(() => user?.gmailConnected ?? false);
  const [isConnecting,   setIsConnecting]   = useState(false);

  // ── Notification state ────────────────────────────────────────
  const [notifications, setNotifications] = useState({
    emailSummaries:    true,
    executionFailures: true,
    weeklyInsights:    false
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // ── Timezone & profile ────────────────────────────────────────
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [profile,  setProfile]  = useState({
    name:  user?.name  || '',
    email: user?.email || '',
    role:  user?.jobTitle || ''
  });
  const [saved,    setSaved]    = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTimezoneSaving, setIsTimezoneSaving] = useState(false);

  // ── Handle ?gmail=connected|error redirect after OAuth ────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gmailParam = params.get('gmail');
    if (gmailParam === 'connected') {
      void refreshUser().then(() => {
        setGmailConnected(true);
        toastSuccess('Gmail connected', 'Your inbox is ready for email-based automations.');
        window.history.replaceState({}, '', '/app/settings');
      });
    } else if (gmailParam === 'error') {
      toastError('Gmail connection failed', 'Google did not complete the authorisation. Please try again.');
      window.history.replaceState({}, '', '/app/settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to OAuth return query
  }, [location.search, refreshUser]);

  // ── Keep profile in sync if user loads after mount ───────────
  useEffect(() => {
    if (user) {
      setProfile({
        name:  user.name || '',
        email: user.email || '',
        role:  user.jobTitle || ''
      });
      setTimezone(user.timezone || 'Asia/Kolkata');
      if (user.notifications) setNotifications(user.notifications);
      setGmailConnected(user.gmailConnected ?? false);
    }
  }, [user]);

  // ── Gmail actions ─────────────────────────────────────────────
  async function handleConnectGmail() {
    setIsConnecting(true);
    try {
      const { authUrl } = await getGmailAuthUrl(token);
      // Full page redirect — Google OAuth needs the browser to actually navigate
      window.location.href = authUrl;
    } catch (err) {
      toastError('Could not start Gmail auth', err.message);
      setIsConnecting(false);
    }
  }

  async function handleDisconnectGmail() {
    setIsConnecting(true);
    try {
      await disconnectGmail(token);
      await refreshUser();
      setGmailConnected(false);
      toastSuccess('Gmail disconnected', 'Email-triggered automations have been paused.');
    } catch (err) {
      toastError('Could not disconnect Gmail', err.message);
    } finally {
      setIsConnecting(false);
    }
  }

  // ── Notification toggling ─────────────────────────────────────
  async function toggleNotification(key) {
    const prev = { ...notifications };
    const next = { ...prev, [key]: !prev[key] };
    setNotifications(next);
    setNotifSaving(true);
    try {
      await saveProfile({ notifications: next });
      toastSuccess('Notification updated', 'Your preference was saved.');
    } catch (err) {
      setNotifications(prev);
      toastError('Could not save preference', err.message);
    } finally {
      setNotifSaving(false);
    }
  }

  // ── Profile form ──────────────────────────────────────────────
  function handleProfileChange(e) {
    setProfile(curr => ({ ...curr, [e.target.name]: e.target.value }));
    setSaved(false);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setIsSaving(true);
    setSaved(false);
    try {
      await saveProfile({
        name: profile.name.trim(),
        jobTitle: profile.role.trim(),
        timezone
      });
      setSaved(true);
      toastSuccess('Profile saved', 'Your profile settings were updated successfully.');
    } catch (err) {
      toastError('Could not save profile', err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTimezoneChange(value) {
    const previous = timezone;
    setTimezone(value);
    setIsTimezoneSaving(true);
    try {
      await saveProfile({ timezone: value });
      toastSuccess('Timezone updated', `Automation timing now follows ${value}.`);
    } catch (err) {
      setTimezone(previous);
      toastError('Could not save timezone', err.message);
    } finally {
      setIsTimezoneSaving(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10';

  if (authLoading) return (
    <AppShell badge="Settings" description="" title="Workspace settings">
      <SettingsSkeleton />
    </AppShell>
  );

  return (
    <AppShell
      badge="Settings"
      description="Manage integrations, personal preferences, and account details from one clean control panel."
      title="Workspace settings"
    >
      <section className="grid gap-6 lg:grid-cols-2">

        {/* Gmail Integration */}
        <article className="card-lift section-rise stagger-1 rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Gmail Integration</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Connect your inbox</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                Sync Gmail so FlowMind can read triggers, classify messages, and automate follow-up work.
              </p>
            </div>
            <span className={[
              'inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition',
              gmailConnected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            ].join(' ')}>
              {gmailConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 px-5 py-5">
            <p className="text-sm font-semibold text-slate-950">
              {gmailConnected ? 'Gmail account linked successfully.' : 'No Gmail account is currently linked.'}
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              {gmailConnected
                ? 'Inbox scanning, label detection, and email-based triggers are now active.'
                : 'Connect your inbox to power email summaries, notifications, and smart classification.'}
            </p>
          </div>

          <div className="mt-6">
            {gmailConnected ? (
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-4 focus:ring-rose-100 disabled:opacity-60"
                disabled={isConnecting}
                onClick={handleDisconnectGmail}
                type="button"
              >
                {isConnecting ? <><span className="spinner !border-rose-300 !border-t-rose-700" />Disconnecting…</> : 'Disconnect Gmail'}
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-60"
                disabled={isConnecting}
                onClick={handleConnectGmail}
                type="button"
              >
                {isConnecting ? <><span className="spinner" />Redirecting to Google…</> : 'Connect Gmail'}
              </button>
            )}
          </div>
        </article>

        {/* Notification Preferences */}
        <article className="card-lift section-rise stagger-2 rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Notification Preferences</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Choose what reaches you</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Decide which updates should surface automatically and which ones can stay quiet.
          </p>
          <div className="mt-8 space-y-4">
            <ToggleRow checked={notifications.emailSummaries}    description="Receive a digest when daily summaries are generated."                   disabled={notifSaving} label="Email summaries"    onChange={() => { void toggleNotification('emailSummaries'); }} />
            <ToggleRow checked={notifications.executionFailures} description="Get alerted when an automation run fails or needs attention."            disabled={notifSaving} label="Execution failures" onChange={() => { void toggleNotification('executionFailures'); }} />
            <ToggleRow checked={notifications.weeklyInsights}    description="Send weekly analytics and trend insights to your inbox."                 disabled={notifSaving} label="Weekly insights"    onChange={() => { void toggleNotification('weeklyInsights'); }} />
          </div>
        </article>

        {/* Timezone */}
        <article className="card-lift section-rise stagger-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Timezone</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Set your automation clock</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">Scheduled runs, reminders, and reports use this timezone.</p>
          <div className="mt-8">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Preferred timezone</span>
              <select
                className={inputCls}
                disabled={isTimezoneSaving}
                onChange={e => { void handleTimezoneChange(e.target.value); }}
                value={timezone}
              >
                {timezoneOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>
        </article>

        {/* Profile */}
        <article className="card-lift section-rise stagger-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Profile Settings</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Update your profile</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">Keep your account details current so collaborators and notifications stay aligned.</p>
          <form className="mt-8 space-y-5" onSubmit={handleSaveProfile}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
              <input className={inputCls} name="name"  onChange={handleProfileChange} type="text"  value={profile.name}  />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
              <input className={`${inputCls} cursor-not-allowed bg-slate-100 text-slate-500`} name="email" readOnly type="email" value={profile.email} />
              <p className="mt-1 text-xs text-slate-400">Email sign-in cannot be changed here.</p>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Role</span>
              <input className={inputCls} name="role"  onChange={handleProfileChange} type="text"  value={profile.role}  />
            </label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-70"
                disabled={isSaving}
                type="submit"
              >
                {isSaving ? <><span className="spinner" />Saving…</> : 'Save Changes'}
              </button>
              {saved && !isSaving ? (
                <span className="flow-fade-up text-sm font-medium text-emerald-600">✓ Settings saved successfully.</span>
              ) : null}
            </div>
          </form>
        </article>

      </section>
    </AppShell>
  );
}

export default SettingsPage;
