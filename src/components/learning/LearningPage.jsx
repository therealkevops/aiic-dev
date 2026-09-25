import React from 'react';
import { BookOpen, CheckCircle2, Clock, GraduationCap, Lock } from 'lucide-react';
import { CATALOG } from '../../learning/catalog';
import { loadProgress } from '../../learning/progress';
import { ModeSwitch, ProductMark } from '../ModeSwitch';

const READY = new Set(); // lessons whose steps are written

export function LearningHeader({ navigate, children }) {
  return (
    <header className="h-14 px-4 bg-zinc-950 border-b border-zinc-800 shrink-0 flex items-center gap-4">
      <ProductMark Icon={GraduationCap} onHome={() => navigate({ page: 'home' })} />
      <ModeSwitch mode="learn" onChange={(m) => navigate({ page: m })} />
      <div className="flex-1 min-w-0">{children}</div>
      <button type="button" onClick={() => navigate({ page: 'guide' })} title="Architecture guide and glossary" className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer shrink-0">
        <BookOpen className="w-3.5 h-3.5" /><span className="hidden xl:inline">Guide</span>
      </button>
    </header>
  );
}

function LessonIndex({ navigate }) {
  const progress = loadProgress();
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-white">Learning path</h1>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Ten lessons that build up how a validated AI infrastructure design is sized, from what a GPU has to hold to what the
          whole solution costs. Each lesson works on a real design with the calculator&apos;s own engine and shows the math behind
          every number. Lessons build on each other, so take them in order.
        </p>
        <ol className="mt-8 divide-y divide-zinc-800 border-y border-zinc-800" data-testid="lesson-list">
          {CATALOG.map(l => {
            const ready = READY.has(l.id);
            const done = !!progress.completed[l.id];
            return (
              <li key={l.id}>
                <button
                  type="button"
                  data-testid={`lesson-${l.id}`}
                  disabled={!ready}
                  onClick={() => navigate({ page: 'learn', lessonId: l.id })}
                  className={`w-full text-left py-4 flex items-start gap-4 ${ready ? 'cursor-pointer hover:bg-zinc-900/60' : 'cursor-default'}`}
                >
                  <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold tabular-nums ${
                    done ? 'bg-emerald-500/15 text-emerald-300' : ready ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900 text-zinc-600'
                  }`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : l.number}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium ${ready ? 'text-zinc-100' : 'text-zinc-500'}`}>{l.title}</span>
                    <span className="block text-[12.5px] text-zinc-500 mt-0.5">{l.summary}</span>
                  </span>
                  <span className="text-[11px] text-zinc-500 shrink-0 flex items-center gap-1 mt-0.5">
                    {ready ? <><Clock className="w-3 h-3" />{l.minutes} min</> : <><Lock className="w-3 h-3" />In preparation</>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}

export function LearningPage({ navigate }) {
  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 antialiased overflow-hidden">
      <LearningHeader navigate={navigate} />
      <LessonIndex navigate={navigate} />
    </div>
  );
}
