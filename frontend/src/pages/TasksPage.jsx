import { useEffect, useMemo, useState } from 'react';
import { AppShell, SkeletonBlock } from '../App';
import { useAuth, useToast } from '../AuthContext';
import { getTasks as fetchTasks, runTask, patchTask, deleteTask as deleteTaskApi } from '../api';

const statusStyles = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Paused: 'bg-amber-50 text-amber-700 border-amber-200',
  Failed: 'bg-rose-50 text-rose-700 border-rose-200'
};

function formatDateTime(value) {
  if (!value) {
    return 'Not scheduled yet';
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

function TasksPage() {
  const { token } = useAuth();
  const { toastError, toastSuccess } = useToast();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningId, setRunningId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadTasks() {
      try {
        setIsLoading(true);
        setError('');
        const data = await fetchTasks(token);

        if (isMounted) {
          setTasks(data.tasks);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
          toastError('Unable to load tasks', loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      active: tasks.filter((task) => task.status === 'Active').length,
      paused: tasks.filter((task) => task.status === 'Paused').length,
      failed: tasks.filter((task) => task.status === 'Failed').length
    };
  }, [tasks]);

  async function handleRunNow(taskId) {
    try {
      setRunningId(taskId);
      await runTask(token, taskId);
      const data = await fetchTasks(token);
      setTasks(data.tasks);
      toastSuccess('Task finished', 'Execution completed. Open Logs or Analytics to review details.');
    } catch (runError) {
      toastError('Run failed', runError.message);
    } finally {
      setRunningId(null);
    }
  }

  async function handlePause(taskId) {
    const existing = tasks.find((task) => task.id === taskId);
    const nextStatus = existing?.status === 'Paused' ? 'Active' : 'Paused';
    try {
      const { task: updated } = await patchTask(token, taskId, { status: nextStatus });
      setTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
      toastSuccess(
        nextStatus === 'Paused' ? 'Task paused' : 'Task resumed',
        nextStatus === 'Paused'
          ? 'The automation will not run until you resume it.'
          : 'The automation is active again.'
      );
    } catch (pauseError) {
      toastError('Could not update task', pauseError.message);
    }
  }

  async function handleEdit(taskId) {
    const existing = tasks.find((task) => task.id === taskId);
    const next = window.prompt('Edit automation description', existing?.commandText || '');
    if (next === null) return;
    if (!next.trim()) {
      toastError('Invalid description', 'Command text cannot be empty.');
      return;
    }
    try {
      const { task: updated } = await patchTask(token, taskId, { commandText: next.trim() });
      setTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
      toastSuccess('Task updated', 'Your automation description was saved.');
    } catch (editError) {
      toastError('Could not update task', editError.message);
    }
  }

  async function handleDelete(taskId) {
    try {
      await deleteTaskApi(token, taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      toastSuccess('Task deleted', 'The automation was removed from this list.');
    } catch (deleteError) {
      toastError('Could not delete task', deleteError.message);
    }
  }

  return (
    <AppShell
      badge="My Tasks"
      description="Review your automation queue, check what is scheduled next, and take action on any workflow."
      title="Automation tasks at a glance"
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card-lift section-rise stagger-1 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Total</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{summary.total}</p>
        </article>
        <article className="card-lift section-rise stagger-2 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Active</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-600">{summary.active}</p>
        </article>
        <article className="card-lift section-rise stagger-3 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Paused</p>
          <p className="mt-3 text-3xl font-semibold text-amber-600">{summary.paused}</p>
        </article>
        <article className="card-lift section-rise stagger-4 rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-soft">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Failed</p>
          <p className="mt-3 text-3xl font-semibold text-rose-600">{summary.failed}</p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft backdrop-blur sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Task Queue</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">My Tasks</h2>
          </div>
          <p className="text-sm leading-7 text-slate-500">
            Tasks sync with the API; run, pause, edit, and delete update the live queue.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-soft"
              >
                <SkeletonBlock className="h-6 w-24" />
                <SkeletonBlock className="mt-4 h-8 w-2/3" />
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <SkeletonBlock className="h-20 w-full" />
                  <SkeletonBlock className="h-20 w-full" />
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

        {!isLoading && !error && tasks.length === 0 ? (
          <div className="mt-8 flex flex-col items-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-2xl font-semibold text-white shadow-glow">
              +
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950">No tasks yet</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500">
              When you save automations, they&apos;ll appear here with run history, status, and quick
              actions so you can manage the queue in one place.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && tasks.length > 0 ? (
          <div className="mt-8 flex flex-col gap-5">
            {tasks.map((task, index) => (
              <article
                key={task.id}
                className="card-lift section-rise rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-soft"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusStyles[task.status]}`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-slate-950">{task.commandText}</h3>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={runningId === task.id}
                      onClick={() => handleRunNow(task.id)}
                      type="button"
                    >
                      {runningId === task.id ? 'Running…' : 'Run Now'}
                    </button>
                    <button
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => handlePause(task.id)}
                      type="button"
                    >
                      {task.status === 'Paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => handleEdit(task.id)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      onClick={() => handleDelete(task.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Next Run</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{formatDateTime(task.nextRunAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Last Run</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{formatDateTime(task.lastRunAt)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

export default TasksPage;
