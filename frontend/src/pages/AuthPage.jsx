// ============================================================
// AuthPage.jsx — Login + Register with spinner & animations
// ============================================================

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../App';
import { useAuth, useToast } from '../AuthContext';

function PasswordVisibilityIcon({ visible }) {
  if (visible) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AuthPage({ mode }) {
  const isLogin     = mode === 'login';
  const navigate    = useNavigate();
  const location    = useLocation();
  const { login, register }            = useAuth();
  const { toastSuccess, toastError }   = useToast();

  const [form, setForm]           = useState(() => (
    isLogin ? { email: '', password: '' } : { name: '', email: '', password: '' }
  ));
  const [error, setError]         = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setForm(isLogin ? { email: '', password: '' } : { name: '', email: '', password: '' });
    setError('');
    setIsSubmitting(false);
    setShowPassword(false);
  }, [isLogin]);

  function handleChange(e) {
    setForm(curr => ({ ...curr, [e.target.name]: e.target.value }));
    if (error) setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(form);
        toastSuccess('Signed in', 'Welcome back to your FlowMind workspace.');
        navigate(location.state?.from?.pathname || '/app', { replace: true });
      } else {
        await register(form);
        toastSuccess('Account created', 'Your FlowMind workspace is ready.');
        navigate('/app', { replace: true });
      }
    } catch (err) {
      setError(err.message);
      toastError(isLogin ? 'Unable to sign in' : 'Unable to register', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10';

  return (
    <AuthLayout
      title={isLogin ? 'Welcome back' : 'Create your account'}
      subtitle={
        isLogin
          ? 'Log in to pick up your projects, ideas, and next moves right where you left them.'
          : 'Start your FlowMind workspace with secure access and a calm, focused onboarding flow.'
      }
      footer={
        isLogin ? (
          <>New here?{' '}<Link className="font-semibold text-primary hover:text-accent" to="/register">Create an account</Link></>
        ) : (
          <>Already have an account?{' '}<Link className="font-semibold text-primary hover:text-accent" to="/login">Log in</Link></>
        )
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>

        {!isLogin && (
          <label className="section-rise stagger-1 block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
            <input
              className={inputCls}
              name="name"
              onChange={handleChange}
              placeholder="Avery Johnson"
              type="text"
              value={form.name || ''}
            />
          </label>
        )}

        <label className={`block section-rise ${isLogin ? 'stagger-1' : 'stagger-2'}`}>
          <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
          <input
            className={inputCls}
            name="email"
            onChange={handleChange}
            placeholder="you@flowmind.app"
            type="email"
            value={form.email}
          />
        </label>

        <div className={`block section-rise ${isLogin ? 'stagger-2' : 'stagger-3'}`}>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={`password-${mode}`}>
            Password
          </label>
          <div className="relative">
            <input
              aria-describedby={error ? 'auth-error' : undefined}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className={`${inputCls} pr-12`}
              id={`password-${mode}`}
              name="password"
              onChange={handleChange}
              placeholder={isLogin ? 'Enter your password' : 'Use at least 6 characters'}
              type={showPassword ? 'text' : 'password'}
              value={form.password}
            />
            <button
              aria-controls={`password-${mode}`}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={0}
              type="button"
            >
              <PasswordVisibilityIcon visible={showPassword} />
            </button>
          </div>
        </div>

        {error ? (
          <div className="pop-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" id="auth-error" role="alert">
            {error}
          </div>
        ) : null}

        <button
          className={`section-rise ${isLogin ? 'stagger-3' : 'stagger-4'} inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70`}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <span className="spinner" />
              {isLogin ? 'Signing in…' : 'Creating account…'}
            </>
          ) : (
            isLogin ? 'Log In' : 'Register'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}

export default AuthPage;
