import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const features = [
  {
    title: 'Natural Language Control',
    description: 'Describe the work in plain English and let AI turn it into structured, repeatable actions.'
  },
  {
    title: 'Connected Workflows',
    description: 'Keep tasks, notes, automations, and project context flowing together in one clear system.'
  },
  {
    title: 'Human-Friendly Visibility',
    description: 'Track what is happening, why it is happening, and what to do next without digging through noise.'
  }
];

const steps = [
  {
    number: '01',
    title: 'Write a simple command',
    description: 'Tell FlowMind what you want done using everyday language instead of rigid automation rules.'
  },
  {
    number: '02',
    title: 'Let AI organize the workflow',
    description: 'FlowMind interprets the task, connects the right steps, and prepares the execution path.'
  },
  {
    number: '03',
    title: 'Review and move faster',
    description: 'Launch with confidence, watch progress clearly, and keep improving your process over time.'
  }
];

function LandingPage() {
  const { isAuthenticated } = useAuth();
  const primaryHref = isAuthenticated ? '/app' : '/register';

  return (
    <main className="page-enter bg-slate-950 text-white">
      <section className="relative overflow-hidden bg-hero-dark">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-12 top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 sm:px-8 lg:px-12 lg:pb-28">
          <header className="flex items-center justify-between gap-4">
            <Link className="inline-flex items-center gap-3" to="/">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-lg font-semibold shadow-glow">
                F
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">FlowMind</p>
                <p className="text-xs text-slate-400">AI workflow operating system</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Link
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/10"
                to="/login"
              >
                Log In
              </Link>
              <Link
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                to={primaryHref}
              >
                {isAuthenticated ? 'Open App' : 'Get Started'}
              </Link>
            </div>
          </header>

          <div className="grid items-center gap-14 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24">
            <div>
              <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-sm font-semibold text-blue-200">
                AI-powered workflow automation
              </span>
              <h1 className="mt-8 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
                Automate your work using simple AI commands
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                FlowMind helps teams turn plain-language requests into guided workflows, organized
                actions, and clear next steps without the usual setup friction.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01]"
                  to={primaryHref}
                >
                  Get Started
                </Link>
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
                  href="#how-it-works"
                >
                  Watch Demo
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-primary/25 to-accent/25 blur-2xl" />
              <div className="card-lift relative rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-glow backdrop-blur">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">Command Center</p>
                    <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Live
                    </span>
                  </div>

                  <div className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Command</p>
                    <p className="mt-3 text-base leading-7 text-white">
                      "Collect new client requests, summarize them, assign owners, and prepare the
                      next action plan."
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">AI Plan</p>
                      <p className="mt-2 text-sm leading-7 text-slate-200">
                        Parse request, group priorities, create tasks, notify the right teammate.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Outcome</p>
                      <p className="mt-2 text-sm leading-7 text-slate-200">
                        Less manual triage, cleaner execution, and a workflow your team can trust.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">Features</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Everything you need to direct AI work with clarity
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature, i) => (
              <article
                key={feature.title}
                className={`card-lift section-rise stagger-${i + 1} rounded-[1.5rem] border border-white/10 bg-white/5 p-7 shadow-soft backdrop-blur`}
              >
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent" />
                <h3 className="mt-6 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 px-6 py-20 sm:px-8 lg:px-12" id="how-it-works">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-purple-300">How It Works</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              A simple path from command to completed work
            </h2>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {steps.map((step, i) => (
              <article
                key={step.number}
                className={`card-lift section-rise stagger-${i + 1} rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-7`}
              >
                <span className="inline-flex rounded-full bg-gradient-to-r from-primary/20 to-accent/20 px-4 py-1 text-sm font-semibold text-white">
                  {step.number}
                </span>
                <h3 className="mt-6 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-20 sm:px-8 lg:px-12">
        <div className="card-lift mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-gradient-to-r from-primary/15 via-slate-900 to-accent/15 p-8 shadow-glow sm:p-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">Ready to start</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Give your team a simpler way to automate meaningful work
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Move from scattered requests to clear execution with an AI workflow layer that feels
              intuitive from day one.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              to={primaryHref}
            >
              Get Started
            </Link>
            <a
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
              href="#how-it-works"
            >
              Watch Demo
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
