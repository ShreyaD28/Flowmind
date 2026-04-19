// ============================================================
// AnalyticsPage.jsx — Real metrics from /api/logs
// ============================================================

import { useEffect, useState } from 'react';
import {
  Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { AppShell, SkeletonBlock } from '../App';
import { useAuth }  from '../AuthContext';
import { getLogs }  from '../api';

// ── Chart helpers ─────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildChartData(logs) {
  const counts = Array(7).fill(0);
  logs.forEach(log => {
    const d = new Date(log.executedAt);
    if (!isNaN(d)) counts[d.getDay()]++;
  });
  // Last 7 calendar days ending today
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const idx = (today - 6 + i + 7) % 7;
    return { day: DAY_LABELS[idx], executions: counts[idx] };
  });
}

function buildSuccessData(successRate) {
  return [
    { name: 'Successful', value: successRate,       color: '#2563EB' },
    { name: 'Other',      value: 100 - successRate, color: '#DBEAFE' }
  ];
}

function mostUsed(logs) {
  const freq = {};
  logs.forEach(l => { freq[l.automationName] = (freq[l.automationName] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
}

// ── Tooltip ───────────────────────────────────────────────────

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pop-in rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-sm text-slate-600">{payload[0].value} tasks executed</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <article key={i} className="card-lift rounded-[1.5rem] border border-white/70 bg-white/90 p-6 shadow-soft">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="mt-4 h-9 w-32" />
          <SkeletonBlock className="mt-3 h-4 w-full" />
        </article>
      ))}
    </section>
  );
}

function ChartSkeleton() {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
      <article className="card-lift rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="mt-3 h-7 w-56" />
        <SkeletonBlock className="mt-8 h-[320px] w-full" />
      </article>
      <article className="card-lift rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
        <SkeletonBlock className="h-5 w-28" />
        <SkeletonBlock className="mt-3 h-7 w-48" />
        <SkeletonBlock className="mt-8 h-[280px] w-full" />
      </article>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────

function AnalyticsPage() {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics,   setMetrics]   = useState({ totalExecutions: 0, successRate: 0, emailsProcessed: 0 });
  const [logs,      setLogs]      = useState([]);
  const [error,     setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await getLogs(token);
        if (!cancelled) {
          setMetrics(data.metrics || {});
          setLogs(data.logs || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const chartData    = buildChartData(logs);
  const successData  = buildSuccessData(metrics.successRate || 0);
  const [topName, topCount] = mostUsed(logs);
  const timeSaved    = ((metrics.emailsProcessed || 0) * 0.3).toFixed(1);

  if (isLoading) return (
    <AppShell badge="Analytics" description="Loading your analytics data…" title="Performance insights">
      <KpiSkeleton />
      <ChartSkeleton />
    </AppShell>
  );

  if (error) return (
    <AppShell badge="Analytics" description="" title="Performance insights">
      <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl">⚠️</div>
        <p className="text-base font-semibold text-rose-700">Could not load analytics</p>
        <p className="max-w-md text-sm text-rose-600">{error}</p>
      </div>
    </AppShell>
  );

  return (
    <AppShell
      badge="Analytics"
      description="Monitor automation volume, reliability, and efficiency — pulled from your live execution logs."
      title="Performance insights for your automations"
    >
      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="card-lift section-rise stagger-1 rounded-[1.5rem] border border-white/70 bg-white/90 p-6 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Time Saved</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{timeSaved} hrs</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">Estimated based on {metrics.emailsProcessed} emails processed this week.</p>
        </article>

        <article className="card-lift section-rise stagger-2 rounded-[1.5rem] border border-white/70 bg-white/90 p-6 shadow-soft xl:col-span-2">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Most Used Automation</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{topName}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">Triggered {topCount} time{topCount !== 1 ? 's' : ''} across your recent logs.</p>
        </article>

        <article className="card-lift section-rise stagger-3 rounded-[1.5rem] border border-white/70 bg-gradient-to-br from-primary to-accent p-6 text-white shadow-glow">
          <p className="text-sm uppercase tracking-[0.22em] text-blue-100">Automation Health</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">{metrics.successRate}%</h2>
          <p className="mt-3 text-sm leading-7 text-blue-50">Success rate across {metrics.totalExecutions} total executions.</p>
        </article>
      </section>

      {/* Charts */}
      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <article className="card-lift section-rise stagger-2 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Tasks Executed</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Workflow activity — last 7 days</h2>
            </div>
            <p className="text-sm leading-7 text-slate-500">{metrics.totalExecutions} total runs</p>
          </div>

          {logs.length === 0 ? (
            <div className="mt-8 flex h-[320px] flex-col items-center justify-center text-center">
              <div className="text-4xl">📊</div>
              <p className="mt-4 text-sm font-medium text-slate-500">No execution data yet.</p>
              <p className="mt-2 text-sm text-slate-400">Run a few automations and come back to see your trends.</p>
            </div>
          ) : (
            <div className="mt-8 h-[320px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <XAxis axisLine={false} dataKey="day" tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} />
                  <YAxis axisLine={false} allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#EFF6FF' }} />
                  <Bar dataKey="executions" fill="#2563EB" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="card-lift section-rise stagger-3 rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-soft sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Success Rate</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Reliable automation performance</h2>
          </div>

          {metrics.totalExecutions === 0 ? (
            <div className="mt-8 flex h-[280px] flex-col items-center justify-center text-center">
              <div className="text-4xl">🎯</div>
              <p className="mt-4 text-sm font-medium text-slate-500">No runs yet to measure.</p>
              <p className="mt-2 text-sm text-slate-400">Your success rate will appear once automations start executing.</p>
            </div>
          ) : (
            <>
              <div className="relative mt-8 flex h-[220px] items-center justify-center">
                <ResponsiveContainer height="100%" width="100%">
                  <PieChart>
                    <Pie cx="50%" cy="50%" data={successData} dataKey="value" innerRadius={72} outerRadius={102} paddingAngle={2} stroke="none">
                      {successData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute flex flex-col items-center">
                  <span className="text-4xl font-semibold tracking-tight text-slate-950">{metrics.successRate}%</span>
                  <span className="mt-2 text-sm text-slate-500">Successful</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {successData.map(item => (
                  <div key={item.name} className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <p className="text-sm font-medium text-slate-700">{item.name}</p>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-slate-950">{item.value}%</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>
      </section>
    </AppShell>
  );
}

export default AnalyticsPage;
