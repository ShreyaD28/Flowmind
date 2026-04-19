// ============================================================
// AuthContext.jsx — Auth + Toast contexts combined
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginUser, registerUser, updateProfile } from './api';

// ── Toast Context ────────────────────────────────────────────

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(curr => curr.filter(t => t.id !== id));
  }, []);

  const pushToast = useCallback(({ title, description = '', type = 'success' }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts(curr => [...curr, { id, title, description, type }]);
    window.setTimeout(() => removeToast(id), 3200);
  }, [removeToast]);

  const value = useMemo(() => ({
    toastSuccess(title, description) { pushToast({ title, description, type: 'success' }); },
    toastError(title, description)   { pushToast({ title, description, type: 'error' }); }
  }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={[
              'pop-in pointer-events-auto rounded-2xl border px-4 py-4 shadow-glow',
              toast.type === 'success' ? 'border-emerald-200 bg-white text-slate-950' : 'border-rose-200 bg-white text-slate-950'
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-sm leading-6 text-slate-500">{toast.description}</p> : null}
              </div>
              <button
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                onClick={() => removeToast(toast.id)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

// ── Auth Context ─────────────────────────────────────────────

const AuthContext = createContext(null);
const STORAGE_KEY = 'flowmind_auth';

function onboardingKey(userId) {
  return `flowmind_onboarding_completed_${userId}`;
}

export function AuthProvider({ children }) {
  const [token, setToken]               = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user,  setUser]                = useState(null);
  const [isLoading, setIsLoading]       = useState(Boolean(localStorage.getItem(STORAGE_KEY)));
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    async function hydrate() {
      if (!token) { setUser(null); setShowOnboarding(false); setIsLoading(false); return; }
      try {
        const data = await getCurrentUser(token);
        setUser(data.user);
        setShowOnboarding(!localStorage.getItem(onboardingKey(data.user.id)));
      } catch (_) {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null); setUser(null); setShowOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    }
    hydrate();
  }, [token]);

  async function login(values) {
    const data = await loginUser(values);
    localStorage.setItem(STORAGE_KEY, data.token);
    setToken(data.token); setUser(data.user);
    setShowOnboarding(!localStorage.getItem(onboardingKey(data.user.id)));
    return data.user;
  }

  async function register(values) {
    const data = await registerUser(values);
    localStorage.setItem(STORAGE_KEY, data.token);
    setToken(data.token); setUser(data.user);
    setShowOnboarding(!localStorage.getItem(onboardingKey(data.user.id)));
    return data.user;
  }

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const data = await getCurrentUser(token);
    setUser(data.user);
    return data.user;
  }, [token]);

  const saveProfile = useCallback(async (payload) => {
    if (!token) throw new Error('Not signed in');
    const data = await updateProfile(token, payload);
    setUser(data.user);
    return data.user;
  }, [token]);

  function logout()             { localStorage.removeItem(STORAGE_KEY); setToken(null); setUser(null); setShowOnboarding(false); }
  function dismissOnboarding()  { setShowOnboarding(false); }
  function completeOnboarding() { if (user?.id) localStorage.setItem(onboardingKey(user.id), 'true'); setShowOnboarding(false); }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: Boolean(user), isLoading, login, register, logout, refreshUser, saveProfile, showOnboarding, dismissOnboarding, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
