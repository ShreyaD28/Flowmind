import { useEffect, useMemo, useState } from 'react';
import { AppShell, SkeletonBlock } from '../App';
import { useAuth, useToast } from '../AuthContext';
import { getLogs as fetchLogs } from '../api';

const statusStyles = {
  Success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Failed: 'bg-rose-50 text-rose-700 border-rose-200',
  Running: 'bg-blue-50 text-blue-700 border-blue-200'
};

function formatDateTime(value) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatDuration(durationMs) {
  if (!durationMs) {
    return 'In progress';
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function getActiveFailureHighlights(logs) {
  const latestByAutomation = new Map();

  for (const log of logs) {
    const key = log.automationName || log.title || log.id;
    if (!latestByAutomation.has(key)) {
      latestByAutomation.set(key, log);
    }
  }

  return Array.from(latestByAutomation.values()).filter((log) => log.status === 'Failed');
}

function parseLogDetails(details) {
  const text = String(details || '').trim();
  if (!text.includes('Individual email summaries:')) {
    return { intro: text, emailBlocks: [] };
  }

  const [intro, summariesText = ''] = text.split('Individual email summaries:');
  const emailBlocks = summariesText
    .split(/\n\s*\n(?=Email \d+)/)
    .map((block) => block.trim())
    .filter(Boolean);

  return {
    intro: intro.trim(),
    emailBlocks
  };
}

function DetailsModal({ log, onClose }) {
  if (!log) {
    return null;
  }

  const { intro, emailBlocks } = parseLogDetails(log.details);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="pop-in w-full max-w-2xl rounded-[1.75rem] border border-white/15 bg-white p-6 shadow-glow sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusStyles[log.status]}`}
            >
              {log.status}
            </span>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{log.title}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{log.automationName}</p>
          </div>

          <button
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Executed</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{formatDateTime(log.executedAt)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Emails</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{log.emailsProcessed}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Duration</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">{formatDuration(log.durationMs)}</p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Summary</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{log.summary}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Details</p>
            {intro ? (
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{intro}</div>
            ) : null}

            {emailBlocks.length > 0 ? (
              <div className="mt-4 grid gap-4">
                {emailBlocks.map((block, index) => (
                  <div key={`${log.id}-email-${index}`} className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{block}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {log.errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-500">Error</p>
              <p className="mt-3 text-sm leading-7 text-rose-700">{log.errorMessage}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LogsPage() {
  const { token } = useAuth();
  const { toastError } = useToast();
  const [metrics, setMetrics] = useState({
    totalExecutions: 0,
    successRate: 0,
    emailsProcessed: 0
  });
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadLogs() {
      try {
        setIsLoading(true);
        setError('');
        const data = await fetchLogs(token);

        if (isMounted) {
          setMetrics(data.metrics);
          setLogs(data.logs);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
          toastError('Unable to load logs', loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLogs();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const errorLogs = useMemo(() => getActiveFailureHighlights(logs), [logs]);
  const hiddenFailureCount = useMemo(() => {
    const totalFailures = logs.filter((log) => log.status === 'Failed').length;
    return Math.max(0, totalFailures - errorLogs.length);
  }, [errorLogs.length, logs]);

  return (
    <AppShell
      badge="Execution Logs"
      description="Track every run, monitor success trends, and inspect failures with detailed context."
      title="Execution history and live pipeline activity"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="card-lift section-rise stagger-1 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Total Executions</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{metrics.totalExecutions}</p>
        </article>
        <article className="card-lift section-rise stagger-2 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Success Rate</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-600">{metrics.successRate}%</p>
        </article>
        <article className="card-lift section-rise stagger-3 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Emails Processed</p>
          <p className="mt-3 text-3xl font-semibold text-blue-600">{metrics.emailsProcessed}</p>
        </article>
      </section>

      {errorLogs.length > 0 ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50/80 p-6 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">Errors</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-rose-900">
                Failed executions need attention
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-rose-700">
              These are the latest unresolved failures for each automation, so older resolved issues
              do not keep crowding the top of the page.
            </p>
          </div>

          {hiddenFailureCount > 0 ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-white/80 px-4 py-3 text-sm text-rose-700">
              {hiddenFailureCount} older failed run{hiddenFailureCount === 1 ? '' : 's'} remain in the
              timeline below for history, but they are no longer shown as active issues here.
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {errorLogs.map((log) => (
              <article
                key={log.id}
                className="card-lift rounded-[1.5rem] border border-rose-200 bg-white px-5 py-5 shadow-soft"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{log.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{log.errorMessage}</p>
                  </div>
                  <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                    Failed
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft backdrop-blur sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Timeline</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Execution Logs</h2>
          </div>
          <p className="text-sm leading-7 text-slate-500">
            Connected to the backend `GET /logs` API for execution history.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="relative pl-8">
                <div className="absolute left-0 top-6 h-6 w-6 rounded-full bg-slate-200" />
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-soft">
                  <SkeletonBlock className="h-6 w-28" />
                  <SkeletonBlock className="mt-4 h-8 w-1/2" />
                  <SkeletonBlock className="mt-4 h-5 w-full" />
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <SkeletonBlock className="h-20 w-full" />
                    <SkeletonBlock className="h-20 w-full" />
                    <SkeletonBlock className="h-20 w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && logs.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-semibold text-white shadow-glow">
              i
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">No execution logs yet</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
              Logs will appear here after scheduled runs or manual executions complete, so you can
              inspect outcomes, errors, and processing details in one place.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && logs.length > 0 ? (
          <div className="mt-10 space-y-6">
            {logs.map((log, index) => (
              <div key={log.id} className="relative pl-8" style={{ animationDelay: `${index * 70}ms` }}>
                {index < logs.length - 1 ? (
                  <div className="absolute left-[11px] top-10 h-[calc(100%+1.5rem)] w-px bg-slate-200" />
                ) : null}
                <div className="absolute left-0 top-6 h-6 w-6 rounded-full border-4 border-white bg-gradient-to-br from-primary to-accent shadow-soft" />

                <article
                  className={[
                    'card-lift rounded-[1.5rem] border p-5 shadow-soft',
                    log.status === 'Failed'
                      ? 'border-rose-200 bg-rose-50/70'
                      : 'border-slate-200 bg-white'
                  ].join(' ')}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusStyles[log.status]}`}
                        >
                          {log.status}
                        </span>
                        <span className="text-sm text-slate-500">{formatDateTime(log.executedAt)}</span>
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-slate-950">{log.title}</h3>
                      <p className="mt-2 text-sm font-medium text-slate-500">{log.automationName}</p>
                      <p className="mt-4 text-sm leading-7 text-slate-600">{log.summary}</p>
                    </div>

                    <button
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => setSelectedLog(log)}
                      type="button"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Emails Processed</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{log.emailsProcessed}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Duration</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{formatDuration(log.durationMs)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Automation</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{log.automationName}</p>
                    </div>
                  </div>

                  {log.errorMessage ? (
                    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-rose-500">Error</p>
                      <p className="mt-3 text-sm leading-7 text-rose-700">{log.errorMessage}</p>
                    </div>
                  ) : null}
                </article>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <DetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </AppShell>
  );
}

export default LogsPage;
