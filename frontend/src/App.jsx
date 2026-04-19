// ============================================================
// App.jsx — Router + layout shells + route guards
//   Absorbs: AppShell, AuthLayout, ProtectedRoute, SkeletonBlock
// ============================================================

import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth }  from './AuthContext';
import AnalyticsPage from './pages/AnalyticsPage';
import AuthPage      from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage   from './pages/LandingPage';
import LogsPage      from './pages/LogsPage';
import SettingsPage  from './pages/SettingsPage';
import TasksPage     from './pages/TasksPage';

// ── Skeleton loader (used in pages) ─────────────────────────

export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton-block ${className}`.trim()} />;
}

// ── AppShell (top nav shared by all /app/* pages) ────────────

function navCls({ isActive }) {
  return [
    'rounded-xl px-4 py-2 text-center text-sm font-semibold transition',
    isActive ? 'bg-slate-950 text-white shadow-soft' : 'text-slate-600 hover:bg-white hover:text-slate-950'
  ].join(' ');
}

export function AppShell({ badge, title, description, children }) {
  const { user, logout } = useAuth();
  return (
    <main className="page-enter min-h-screen bg-hero px-6 py-10 text-ink sm:px-8 lg:px-12">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="card-lift flex flex-col gap-5 rounded-[1.75rem] border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                {badge}
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {description} Signed in as {user?.name}.
              </p>
            </div>
            <button
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/10"
              onClick={logout}
              type="button"
            >
              Log Out
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-2 md:grid-cols-3 xl:grid-cols-5">
            <NavLink className={navCls} end to="/app">Create Automation</NavLink>
            <NavLink className={navCls} to="/app/analytics">Analytics</NavLink>
            <NavLink className={navCls} to="/app/tasks">My Tasks</NavLink>
            <NavLink className={navCls} to="/app/logs">Execution Logs</NavLink>
            <NavLink className={navCls} to="/app/settings">Settings</NavLink>
          </div>
        </header>

        <div className="page-enter flex flex-col gap-8">{children}</div>
      </section>
    </main>
  );
}

// ── AuthLayout (two-column shell for Login / Register) ───────

export function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <main className="page-enter min-h-screen bg-hero px-6 py-10 text-ink sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/75 shadow-soft backdrop-blur lg:grid-cols-[1fr_460px]">
          <section className="hidden bg-slate-950 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">FlowMind</span>
              <h1 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">Think clearly. Organize deeply. Move with flow.</h1>
              <p className="mt-5 max-w-md text-base leading-8 text-slate-300">Your ideas, projects, and next actions come together in a workspace designed to feel calm, focused, and fast.</p>
            </div>
            <div className="grid gap-4">
              <div className="card-lift rounded-xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Mind Map Ready</p>
                <p className="mt-2 text-lg font-semibold">Auth scaffolding is now part of the product foundation.</p>
              </div>
              <div className="card-lift rounded-xl bg-gradient-to-r from-primary to-accent p-[1px]">
                <div className="rounded-[15px] bg-slate-950 px-5 py-4">
                  <p className="text-sm text-slate-300">Secure access, smooth onboarding, protected routes.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-md">
              <div className="card-lift rounded-xl border border-slate-200/80 bg-white p-8 shadow-soft">
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">FlowMind Auth</span>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">{subtitle}</p>
                <div className="mt-8">{children}</div>
                <div className="mt-6 text-sm text-slate-500">{footer}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// ── Route guards ─────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero px-6">
        <div className="rounded-xl border border-white/70 bg-white/90 px-6 py-5 shadow-soft">
          <p className="text-sm font-medium text-slate-500">Loading your FlowMind workspace...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate replace state={{ from: location }} to="/login" />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate replace to="/app" />;
  return children;
}

// ── App Router ───────────────────────────────────────────────

function App() {
  return (
    <Routes>
      <Route path="/"             element={<LandingPage />} />
      <Route path="/app"          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/app/analytics"element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/app/tasks"    element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
      <Route path="/app/logs"     element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
      <Route path="/app/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/login"        element={<PublicOnlyRoute><AuthPage mode="login" /></PublicOnlyRoute>} />
      <Route path="/register"     element={<PublicOnlyRoute><AuthPage mode="register" /></PublicOnlyRoute>} />
      <Route path="*"             element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export default App;
