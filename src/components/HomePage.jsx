import React from 'react';
import { ArrowRight, BookOpen, Check, Compass, GraduationCap, Server, SlidersHorizontal } from 'lucide-react';
import { CATALOG, CORE, PRODUCTION } from '../learning/catalog';
import { loadProgress } from '../learning/progress';
import { USE_CASE_PRESETS } from '../data/presets';

function Point({ children }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-zinc-300">
      <Check className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function ModeCard({ testId, icon: Icon, title, tagline, points, footer, primary, secondary }) {
  return (
    <div data-testid={testId} className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-800 text-sky-400 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{tagline}</p>
      <ul className="mt-4 space-y-2 flex-1">{points.map((p, i) => <Point key={i}>{p}</Point>)}</ul>
      {footer}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid={primary.testId}
          onClick={primary.onClick}
          className="h-10 sm:h-9 inline-flex items-center gap-1.5 px-4 whitespace-nowrap rounded-md bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white cursor-pointer"
        >
          {primary.label} <ArrowRight className="w-4 h-4" />
        </button>
        {secondary && (
          <button
            type="button"
            onClick={secondary.onClick}
            className="h-10 sm:h-9 inline-flex items-center gap-1.5 px-3 whitespace-nowrap rounded-md border border-zinc-700 hover:bg-zinc-800 text-sm text-zinc-200 cursor-pointer"
          >
            {secondary.icon && <secondary.icon className="w-4 h-4 text-zinc-400" />}
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function HomePage({ onLearn, onAdvanced, onGuidedSetup, onGuide }) {
  const progress = loadProgress();
  const done = CATALOG.filter(l => progress.completed[l.id]).length;
  const resume = CATALOG.find(l => l.id === progress.lastLessonId && !progress.completed[l.id])
    || CATALOG.find(l => !progress.completed[l.id]);
  const started = done > 0 || !!progress.lastLessonId;

  return (
    <div className="min-h-[100dvh] w-full bg-zinc-950 text-zinc-100 antialiased overflow-y-auto">
      <header className="h-14 px-4 sm:px-6 border-b border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-sky-600 text-white flex items-center justify-center">
            <Server className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-white truncate">AI Infrastructure Sizer</span>
        </div>
        <button type="button" onClick={onGuide} className="shrink-0 h-10 sm:h-8 inline-flex items-center gap-1.5 px-2.5 whitespace-nowrap rounded-md text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer">
          <BookOpen className="w-3.5 h-3.5" /> <span className="sm:hidden">Guide</span><span className="hidden sm:inline">Architecture guide</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-14 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Design private AI infrastructure with confidence</h1>
        <p className="mt-3 text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Size GPU servers, networking, storage, power and cost for AI inference and training, using the same sizing engine
          in both modes. Choose how you want to work; you can switch at any time from the header.
        </p>

        <div className="mt-8 sm:mt-10 grid md:grid-cols-2 gap-4 sm:gap-5">
          <ModeCard
            testId="mode-card-learn"
            icon={GraduationCap}
            title="Learning"
            tagline="For solutions architects building their expertise: learn how complex AI infrastructure is designed, one concept at a time, on validated reference designs."
            points={[
              `${CORE.length}-lesson core path from GPU memory to TCO, plus ${PRODUCTION.length} production topics`,
              'Change real designs and watch the numbers respond, with the math shown',
              'Predict-then-check questions, a scored capstone and a shareable learning record',
            ]}
            footer={started && (
              <div className="mt-5">
                <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                  <span>Progress</span><span className="tabular-nums">{done} of {CATALOG.length} lessons</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${(done / CATALOG.length) * 100}%` }} />
                </div>
              </div>
            )}
            primary={{
              testId: 'start-learning',
              label: started && resume ? `Resume: lesson ${resume.number}` : 'Start learning',
              onClick: () => onLearn(started && resume ? resume.id : null),
            }}
          />
          <ModeCard
            testId="mode-card-advanced"
            icon={SlidersHorizontal}
            title="Advanced"
            tagline="The full calculator for sizing real opportunities: every setting, with comparison, planning and exportable reports."
            points={[
              `${USE_CASE_PRESETS.length} validated use-case presets across enterprise, agentic and neo-cloud`,
              'Latency targets, traffic sizing, disaggregated serving and rack-scale NVLink',
              'Scenario comparison, sensitivity, rent vs buy and printable reports',
            ]}
            primary={{ testId: 'open-advanced', label: 'Open calculator', onClick: onAdvanced }}
            secondary={{ label: 'Guided setup', icon: Compass, onClick: onGuidedSetup }}
          />
        </div>

        <p className="mt-8 text-xs text-zinc-500">
          Figures are planning estimates from an analytical model calibrated against published benchmarks; prices are illustrative, not vendor quotes.
        </p>
      </main>
    </div>
  );
}
