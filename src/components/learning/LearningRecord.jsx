import React, { useState } from 'react';
import { Award, CheckCircle2, Circle, FileDown, Printer } from 'lucide-react';
import { loadProgress, saveProgress } from '../../learning/progress';
import { PASS_PCT, buildRecordHtml, recordSummary } from '../../learning/record';

function LessonRows({ lessons }) {
  return (
    <ol className="divide-y divide-zinc-800 border-y border-zinc-800">
      {lessons.map(l => (
        <li key={l.id} className="py-2.5 flex items-center gap-3 text-sm">
          {l.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-zinc-600 shrink-0" />}
          <span className="flex-1 min-w-0 text-zinc-200"><span className="text-zinc-500 tabular-nums mr-1.5">{l.number}.</span>{l.title}</span>
          <span className="text-xs text-zinc-500 tabular-nums shrink-0">{l.done ? (l.completedOn || 'Completed') : ''}</span>
        </li>
      ))}
    </ol>
  );
}

/** A printable summary of this browser's progress, for sharing with a manager. */
export function LearningRecord() {
  const [progress, setProgress] = useState(loadProgress);
  const r = recordSummary(progress);
  const setName = (name) => {
    const next = { ...loadProgress(), name };
    saveProgress(next);
    setProgress(next);
  };
  const html = () => buildRecordHtml(progress);
  const download = () => {
    const url = URL.createObjectURL(new Blob([html()], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-record${progress.name ? `-${progress.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) { download(); return; } // pop-ups blocked: fall back to the file
    w.document.write(html());
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <main className="flex-1 overflow-y-auto" data-testid="learning-record">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 text-sky-400"><Award className="w-5 h-5" /><span className="text-xs font-medium">Learning record</span></div>
        <h1 className="mt-2 text-2xl font-semibold text-white">Your progress</h1>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          A summary of the lessons completed in this browser, to print or save and share. Add your name so the record says whose it is.
        </p>

        <label className="mt-6 block max-w-sm">
          <span className="text-xs text-zinc-400">Your name</span>
          <input
            type="text"
            data-testid="record-name"
            value={progress.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam Taylor"
            className="mt-1 w-full h-10 bg-zinc-900 border border-zinc-700 rounded-md px-3 text-sm text-zinc-100 focus:outline-none focus:border-sky-500"
          />
        </label>

        <div className={`mt-6 rounded-xl border p-5 ${r.pathComplete ? 'border-emerald-800 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/60'}`} data-testid="record-status">
          <div className={`text-base font-semibold ${r.pathComplete ? 'text-emerald-200' : 'text-white'}`}>
            {r.pathComplete ? 'Core path complete' : 'Core path in progress'}
          </div>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-zinc-500">Core lessons</dt><dd className="text-zinc-100 tabular-nums">{r.coreDone} of {r.coreTotal}</dd></div>
            <div><dt className="text-xs text-zinc-500">Capstone quiz (pass {PASS_PCT}%)</dt><dd className="text-zinc-100 tabular-nums">{r.quizBest != null ? `${r.quizBest}%${r.quizPassed ? ', passed' : ''}` : 'Not taken'}</dd></div>
            <div><dt className="text-xs text-zinc-500">Production topics</dt><dd className="text-zinc-100 tabular-nums">{r.productionDone} of {r.productionTotal}</dd></div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" data-testid="record-download" onClick={download} className="h-10 sm:h-9 inline-flex items-center gap-1.5 px-3 whitespace-nowrap rounded-md bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white cursor-pointer">
              <FileDown className="w-4 h-4" /> Download record
            </button>
            <button type="button" onClick={print} className="h-10 sm:h-9 inline-flex items-center gap-1.5 px-3 whitespace-nowrap rounded-md border border-zinc-700 hover:bg-zinc-800 text-sm text-zinc-200 cursor-pointer">
              <Printer className="w-4 h-4 text-zinc-400" /> Print or save as PDF
            </button>
          </div>
        </div>

        <h2 className="mt-8 mb-2 text-sm font-semibold text-zinc-100">Core path</h2>
        <LessonRows lessons={r.lessons.filter(l => l.track === 'core')} />
        <h2 className="mt-8 mb-2 text-sm font-semibold text-zinc-100">Production topics</h2>
        <LessonRows lessons={r.lessons.filter(l => l.track === 'production')} />

        <p className="mt-8 text-xs text-zinc-500 leading-relaxed">
          This is a self-reported record: progress is kept only in this browser, and clearing site data removes it. It is not a verified certification.
        </p>
      </div>
    </main>
  );
}
