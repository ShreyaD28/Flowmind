import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../App';
import { useAuth, useToast } from '../AuthContext';
import { parseTask, previewTask } from '../api';

const suggestions = [
  'Summarize emails daily',
  'Notify me about HR emails',
  'Classify incoming emails'
];

function buildPreviewSteps(parsed) {
  if (!parsed) return [];
  return [
    {
      title: 'Trigger',
      subtitle: 'When this runs',
      detail: `Runs ${parsed.frequency} at ${parsed.time}`
    },
    {
      title: 'Source',
      subtitle: 'Where data comes from',
      detail: parsed.source
    },
    {
      title: 'Condition',
      subtitle: 'What to check',
      detail: parsed.condition
    },
    {
      title: 'Action',
      subtitle: 'What happens next',
      detail: parsed.action
    }
  ];
}

const onboardingSteps = [
  {
    title: 'Connect Gmail',
    description: 'Link your inbox so FlowMind can watch for email-based triggers and automate follow-up work.',
    actionLabel: 'Open Gmail Settings'
  },
  {
    title: 'Create first automation',
    description: 'Start with a guided example so your first workflow is ready in seconds.',
    actionLabel: 'Use Starter Automation'
  },
  {
    title: 'View results',
    description: 'Preview the pipeline and see how FlowMind turns your prompt into a working automation.',
    actionLabel: 'View Results'
  }
];

function OnboardingModal({
  currentStep,
  gmailConnected,
  onClose,
  onNext,
  onPrevious
}) {
  const step = onboardingSteps[currentStep];
  const progressWidth = `${((currentStep + 1) / onboardingSteps.length) * 100}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[1.75rem] border border-white/20 bg-white p-6 shadow-glow sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              Getting Started
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {step.title}
            </h2>
          </div>

          <button
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Skip for now
          </button>
        </div>

        <div className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
              style={{ width: progressWidth }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Step {currentStep + 1} of {onboardingSteps.length}
          </p>
        </div>

        <div className="mt-8 rounded-[1.5rem] bg-slate-50 px-5 py-5">
          <p className="text-base leading-8 text-slate-600">{step.description}</p>
          {currentStep === 0 ? (
            <div className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {gmailConnected ? 'Gmail Connected' : 'Awaiting Gmail Connection'}
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={currentStep === 0}
            onClick={onPrevious}
            type="button"
          >
            Back
          </button>

          <button
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-primary/20"
            onClick={onNext}
            type="button"
          >
            {step.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { showOnboarding, dismissOnboarding, completeOnboarding, token, user } = useAuth();
  const { toastSuccess, toastError } = useToast();
  const navigate = useNavigate();
  const [automationPrompt, setAutomationPrompt] = useState('');
  const [showPreview, setShowPreview]   = useState(false);
  const [isSaved,     setIsSaved]       = useState(false);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [isSaving,    setIsSaving]      = useState(false);
  const [gmailConnected, setGmailConnected] = useState(() => Boolean(user?.gmailConnected));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [parsedPreview, setParsedPreview] = useState(null);
  const previewTimeoutRef = useRef(null);
  const promptInputRef = useRef(null);

  const starterAutomation = useMemo(() => suggestions[0], []);

  useEffect(() => {
    setGmailConnected(Boolean(user?.gmailConnected));
  }, [user?.gmailConnected]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  const previewSteps = useMemo(() => buildPreviewSteps(parsedPreview), [parsedPreview]);

  function handleSuggestionClick(suggestion) {
    setAutomationPrompt(suggestion);
    setShowPreview(false);
    setParsedPreview(null);
    setIsSaved(false);
  }

  async function handlePreview() {
    const commandText = (promptInputRef.current?.value ?? automationPrompt).trim();
    if (!commandText) return;
    if (!token) {
      toastError('Sign in required', 'Log in to preview automations.');
      return;
    }

    setAutomationPrompt(commandText);

    setIsAnalyzing(true);
    setShowPreview(false);
    setParsedPreview(null);
    setIsSaved(false);
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
    }

    try {
      const { parsedTask } = await previewTask(token, commandText);
      setParsedPreview(parsedTask);
      setShowPreview(true);
      toastSuccess('Task preview ready', 'FlowMind turned your prompt into a structured workflow.');
    } catch (err) {
      toastError('Preview failed', err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSave() {
    const commandText = (promptInputRef.current?.value ?? automationPrompt).trim();
    if (!commandText || isSaving) return;
    if (!token) {
      toastError('Sign in required', 'Log in to save automations.');
      return;
    }
    setAutomationPrompt(commandText);
    setIsSaving(true);
    try {
      await parseTask(token, commandText, parsedPreview || undefined);
      setIsSaved(true);
      toastSuccess('Automation saved', 'Your workflow is active and will run on schedule.');
      // Navigate to tasks page after short delay so the toast is seen
      window.setTimeout(() => navigate('/app/tasks'), 900);
    } catch (err) {
      toastError('Could not save automation', err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleOnboardingNext() {
    if (onboardingStep === 0) {
      dismissOnboarding();
      navigate('/app/settings');
      return;
    }

    if (onboardingStep === 1) {
      setAutomationPrompt(starterAutomation);
      setShowPreview(false);
      setParsedPreview(null);
      setIsSaved(false);
      setOnboardingStep(2);
      return;
    }

    setIsSaved(false);
    completeOnboarding();
    setOnboardingStep(0);
    if (token) {
      setIsAnalyzing(true);
      setShowPreview(false);
      setParsedPreview(null);
      previewTask(token, starterAutomation)
        .then(({ parsedTask }) => {
          setAutomationPrompt(starterAutomation);
          setParsedPreview(parsedTask);
          setShowPreview(true);
        })
        .catch((err) => toastError('Preview failed', err.message))
        .finally(() => setIsAnalyzing(false));
    } else {
      toastError('Sign in required', 'Log in to generate a workflow preview.');
    }
  }

  function handleOnboardingPrevious() {
    setOnboardingStep((current) => Math.max(current - 1, 0));
  }

  function handleOnboardingClose() {
    dismissOnboarding();
    setOnboardingStep(0);
  }

  return (
    <AppShell
      badge="Create Automation"
      description="Describe the work once, preview the pipeline, and save the automation when it looks right."
      title="Design an AI workflow in one clear prompt"
    >
      {showOnboarding ? (
        <OnboardingModal
          currentStep={onboardingStep}
          gmailConnected={gmailConnected}
          onClose={handleOnboardingClose}
          onNext={handleOnboardingNext}
          onPrevious={handleOnboardingPrevious}
        />
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/85 px-6 py-10 shadow-soft backdrop-blur sm:px-8 lg:px-12 lg:py-14">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="rounded-full bg-gradient-to-r from-primary/15 to-accent/15 px-4 py-1 text-sm font-semibold text-primary">
            AI Automation Builder
          </div>
          <h2 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Tell FlowMind what you want to automate
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Start with a natural-language task, then preview the workflow structure before you
            commit it.
          </p>
          <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
            Gmail integration: {gmailConnected ? 'Connected' : 'Not connected yet'}
          </div>

          <div className="mt-10 w-full">
            <div className="card-lift rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
              <textarea
                ref={promptInputRef}
                name="command"
                className="min-h-[180px] w-full resize-none rounded-[1.25rem] border border-slate-200 bg-slate-50 px-5 py-4 text-base text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 sm:min-h-[220px] sm:text-lg"
                onChange={(event) => {
                  if (previewTimeoutRef.current) {
                    window.clearTimeout(previewTimeoutRef.current);
                  }
                  const next = event.target.value;
                  setAutomationPrompt(next);
                  setIsAnalyzing(false);
                  setShowPreview(false);
                  setParsedPreview(null);
                  setIsSaved(false);
                }}
                placeholder="Describe what you want to automate..."
                value={automationPrompt}
              />

              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                    onClick={() => handleSuggestionClick(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  className="rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!automationPrompt.trim()}
                  onClick={() => { void handlePreview(); }}
                  type="button"
                >
                  Preview Task
                </button>
              </div>
            </div>
          </div>
        </div>

        {isAnalyzing ? (
          <div className="flow-fade-up mx-auto mt-12 max-w-2xl">
            <div className="card-lift rounded-[1.75rem] border border-primary/15 bg-slate-950 px-6 py-6 text-white shadow-glow">
              <div className="flex items-center justify-center gap-3">
                <span className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
                  AI is analyzing...
                </span>
                <div className="flex items-center gap-1">
                  <span className="ai-typing-dot h-2 w-2 rounded-full bg-blue-300" />
                  <span className="ai-typing-dot h-2 w-2 rounded-full bg-blue-300" />
                  <span className="ai-typing-dot h-2 w-2 rounded-full bg-blue-300" />
                </div>
              </div>
              <p className="mt-4 text-center text-sm leading-7 text-slate-300">
                FlowMind is translating your plain-English request into a trigger, source,
                condition, and action pipeline.
              </p>
            </div>
          </div>
        ) : null}

        {showPreview && previewSteps.length ? (
          <div className="flow-fade-up mx-auto mt-12 max-w-5xl">
            <div className="card-lift rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-glow sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">
                    Workflow Preview
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                    Suggested automation pipeline
                  </h3>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  Based on: <span className="font-medium text-white">{automationPrompt}</span>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
                {previewSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="flex items-center gap-4 lg:flex-1 lg:flex-row"
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <article className="flow-step flex-1 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex rounded-full bg-gradient-to-r from-primary/20 to-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                          Step {index + 1}
                        </span>
                        <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                          {step.title}
                        </span>
                      </div>
                      <h4 className="mt-5 text-xl font-semibold text-white">{step.title}</h4>
                      <p className="mt-3 text-sm font-medium text-blue-200">{step.subtitle}</p>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{step.detail}</p>
                    </article>

                    {index < previewSteps.length - 1 ? (
                      <div className="hidden items-center justify-center lg:flex">
                        <div className="flow-connector flex items-center gap-2">
                          <div className="h-px w-10 bg-gradient-to-r from-primary to-accent" />
                          <div className="h-0 w-0 border-b-[6px] border-l-[10px] border-t-[6px] border-b-transparent border-l-accent border-t-transparent" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <p className="text-sm leading-7 text-slate-300">
                  Review each step, then save the automation when the pipeline looks right.
                </p>
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={isSaving}
                  onClick={() => { void handleSave(); }}
                  type="button"
                >
                  {isSaving ? <><span className="spinner" />Saving…</> : 'Confirm & Save'}
                </button>
              </div>

              {isSaved ? (
                <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-200">
                  Automation saved to your FlowMind workspace.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

export default DashboardPage;
