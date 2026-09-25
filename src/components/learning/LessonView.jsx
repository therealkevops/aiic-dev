import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Lightbulb, RotateCcw, SlidersHorizontal, Target, X } from 'lucide-react';
import { computeScenario } from '../../utils/scenario';
import { CATALOG } from '../../learning/catalog';
import { CONTROLS, LESSONS, METRICS, controlId, controlOptions, controlSet, controlValue } from '../../learning/lessons';
import { loadProgress, saveProgress } from '../../learning/progress';

function Paragraphs({ text }) {
  return String(text).split('\n\n').map((p, i) => <p key={i} className="text-[13.5px] text-zinc-300 leading-relaxed">{p}</p>);
}

function ControlGroup({ entry, value, onChange }) {
  const id = controlId(entry);
  const def = CONTROLS[id];
  return (
    <div>
      <div className="text-[12px] font-medium text-zinc-300 mb-1.5">{def.label}</div>
      <div role="radiogroup" aria-label={def.label} className="flex flex-wrap gap-1.5">
        {controlOptions(entry).map(o => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`control-${id}-${o.value}`}
              onClick={() => onChange(o.value)}
              className={`h-8 px-3 rounded-md border text-xs font-medium transition cursor-pointer ${
                active ? 'bg-sky-600 border-sky-500 text-white' : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetricTile({ id, scenario, config, highlighted }) {
  const m = METRICS[id];
  const v = m.value(scenario, config);
  return (
    <div
      data-testid={`metric-${id}`}
      className={`rounded-lg border p-3 transition ${highlighted ? 'border-sky-500/70 bg-sky-500/5' : 'border-zinc-800 bg-zinc-900/60'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-400">{m.label}</span>
        {highlighted && <span className="text-[10px] font-medium text-sky-300">Watch</span>}
      </div>
      <div className="text-lg font-semibold text-zinc-50 tabular-nums mt-0.5">{m.format(v, scenario, config)}</div>
    </div>
  );
}

function PredictStep({ step, chosen, onChoose }) {
  const answered = chosen != null;
  return (
    <div className="space-y-3">
      <Paragraphs text={step.body} />
      <div className="text-[13.5px] font-medium text-zinc-100">{step.question}</div>
      <div className="grid gap-1.5" role="radiogroup" aria-label={step.question}>
        {step.options.map((o, i) => {
          const isAnswer = i === step.answer;
          const isChosen = i === chosen;
          const tone = !answered
            ? 'border-zinc-700 hover:border-zinc-500 text-zinc-200'
            : isAnswer ? 'border-emerald-600 bg-emerald-500/10 text-emerald-200'
              : isChosen ? 'border-red-700 bg-red-500/10 text-red-200' : 'border-zinc-800 text-zinc-500';
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isChosen}
              data-testid={`predict-option-${i}`}
              disabled={answered}
              onClick={() => onChoose(i)}
              className={`text-left h-9 px-3 rounded-md border text-[13px] flex items-center justify-between ${answered ? 'cursor-default' : 'cursor-pointer'} ${tone}`}
            >
              <span>{o}</span>
              {answered && isAnswer && <Check className="w-4 h-4" />}
              {answered && isChosen && !isAnswer && <X className="w-4 h-4" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="rounded-md bg-zinc-900 border border-zinc-800 p-3 text-[12.5px] text-zinc-300 leading-relaxed">
          <span className={`font-medium ${chosen === step.answer ? 'text-emerald-300' : 'text-zinc-100'}`}>
            {chosen === step.answer ? 'Correct. ' : 'Not quite. '}
          </span>
          {step.explain}
        </div>
      )}
    </div>
  );
}

function TaskStep({ step, complete }) {
  const [hint, setHint] = useState(false);
  return (
    <div className="space-y-3">
      <Paragraphs text={step.body} />
      <div className={`rounded-md border p-3 ${complete ? 'border-emerald-700 bg-emerald-500/5' : 'border-sky-800 bg-sky-500/5'}`} data-testid="task-box">
        <div className="flex items-start gap-2">
          {complete ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> : <Target className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />}
          <div className="text-[13px] font-medium text-zinc-100">{step.task}</div>
        </div>
        {complete ? (
          <p className="mt-2 text-[12.5px] text-zinc-300 leading-relaxed">{step.done}</p>
        ) : (
          <div className="mt-2">
            {hint
              ? <p className="text-[12px] text-zinc-400">{step.hint}</p>
              : <button type="button" onClick={() => setHint(true)} className="text-[12px] text-sky-400 hover:underline cursor-pointer inline-flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" />Show a hint</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function LessonView({ lessonId, navigate, onOpenInAdvanced }) {
  const lesson = LESSONS[lessonId];
  const meta = CATALOG.find(l => l.id === lessonId);
  const saved = loadProgress().steps[lessonId] || {};
  const [values, setValues] = useState(saved.values || {});
  const [stepIdx, setStepIdx] = useState(Math.min(saved.step || 0, lesson.steps.length - 1));
  const [answers, setAnswers] = useState(saved.answers || {});
  const [finished, setFinished] = useState(false);
  const [mathOpen, setMathOpen] = useState(true);

  const base = useMemo(() => lesson.start(), [lesson]);
  const config = useMemo(() => ({ ...base, ...values }), [base, values]);
  const scenario = useMemo(() => computeScenario(config), [config]);
  const step = lesson.steps[stepIdx];
  const taskDone = step.kind === 'task' && step.check(config, scenario);
  const canAdvance = step.kind === 'read' || step.kind === 'recap' || (step.kind === 'predict' && answers[stepIdx] != null) || taskDone;
  const highlight = new Set(step.highlight || []);

  useEffect(() => {
    const p = loadProgress();
    saveProgress({ ...p, lastLessonId: lessonId, steps: { ...p.steps, [lessonId]: { step: stepIdx, values, answers } } });
  }, [lessonId, stepIdx, values, answers]);

  const finish = () => {
    const p = loadProgress();
    saveProgress({ ...p, completed: { ...p.completed, [lessonId]: true } });
    setFinished(true);
  };
  const next = CATALOG.find(l => l.number === meta.number + 1);
  const nextReady = next && LESSONS[next.id];

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(340px,400px)_1fr_minmax(300px,360px)]">
      {/* Steps */}
      <section aria-label="Lesson steps" className="border-r border-zinc-800 overflow-y-auto flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
          <div className="text-[11px] text-zinc-500">Lesson {meta.number} of {CATALOG.length}</div>
          <h1 className="text-[17px] font-semibold text-white mt-0.5 leading-snug">{meta.title}</h1>
          <p className="text-[12.5px] text-zinc-400 mt-1.5 leading-relaxed">{lesson.objective}</p>
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {lesson.steps.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < stepIdx ? 'bg-sky-600' : i === stepIdx ? 'bg-sky-400' : 'bg-zinc-800'}`} />
            ))}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1.5 tabular-nums">Step {stepIdx + 1} of {lesson.steps.length}</div>
        </div>

        <div className="px-5 py-5 flex-1 space-y-4" data-testid="lesson-step">
          <h2 className="text-[15px] font-semibold text-zinc-100">{step.title}</h2>
          {step.kind === 'read' && <Paragraphs text={step.body} />}
          {step.kind === 'predict' && (
            <PredictStep step={step} chosen={answers[stepIdx]} onChoose={(i) => setAnswers(a => ({ ...a, [stepIdx]: i }))} />
          )}
          {step.kind === 'task' && <TaskStep key={stepIdx} step={step} complete={taskDone} />}
          {step.kind === 'recap' && (
            <>
              <ul className="space-y-2">
                {step.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-zinc-300 leading-relaxed">
                    <Check className="w-3.5 h-3.5 text-sky-400 mt-1 shrink-0" /><span>{pt}</span>
                  </li>
                ))}
              </ul>
              {finished && (
                <div className="rounded-lg border border-emerald-800 bg-emerald-500/5 p-4 space-y-3" data-testid="lesson-complete">
                  <div className="text-[13.5px] font-semibold text-emerald-200">Lesson {meta.number} complete</div>
                  <div className="flex flex-col gap-2">
                    {nextReady && (
                      <button type="button" data-testid="next-lesson" onClick={() => navigate({ page: 'learn', lessonId: next.id })} className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white cursor-pointer">
                        Next: {next.title} <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" data-testid="open-in-advanced" onClick={() => onOpenInAdvanced(config)} className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-sm text-zinc-200 cursor-pointer">
                      <SlidersHorizontal className="w-4 h-4 text-zinc-400" /> Open this design in Advanced mode
                    </button>
                    <button type="button" onClick={() => navigate({ page: 'guide', docId: meta.guideChapter })} className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer">
                      <BookOpen className="w-4 h-4 text-zinc-400" /> Read more in the Architecture Guide
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIdx(i => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            className="h-8 inline-flex items-center gap-1 px-2.5 rounded-md text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          {step.kind === 'recap' ? (
            !finished && (
              <button type="button" data-testid="finish-lesson" onClick={finish} className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white cursor-pointer">
                <Check className="w-3.5 h-3.5" /> Finish lesson
              </button>
            )
          ) : (
            <button
              type="button"
              data-testid="next-step"
              onClick={() => setStepIdx(i => Math.min(lesson.steps.length - 1, i + 1))}
              disabled={!canAdvance}
              title={canAdvance ? undefined : step.kind === 'task' ? 'Complete the task to continue' : 'Choose an answer to continue'}
              className="h-8 inline-flex items-center gap-1 px-3 rounded-md bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-default cursor-pointer"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Design workbench */}
      <section aria-label="Design" className="overflow-y-auto p-6 space-y-5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[13.5px] font-semibold text-zinc-100">Your design</h2>
              <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">{lesson.design}</p>
            </div>
            <button type="button" onClick={() => setValues({})} title="Reset the design to the lesson's starting point" className="h-7 shrink-0 inline-flex items-center gap-1 px-2 rounded-md text-[11.5px] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
          {lesson.controls.map(entry => {
            const id = controlId(entry);
            return <ControlGroup key={id} entry={entry} value={controlValue(id, config)} onChange={(v) => setValues(vs => ({ ...vs, ...controlSet(id, v) }))} />;
          })}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
          <button type="button" onClick={() => setMathOpen(o => !o)} aria-expanded={mathOpen} className="w-full px-5 py-3 flex items-center justify-between text-left cursor-pointer">
            <span className="text-[13.5px] font-semibold text-zinc-100">Show the math</span>
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition ${mathOpen ? 'rotate-180' : ''}`} />
          </button>
          {mathOpen && (
            <div className="px-5 pb-4" data-testid="show-the-math">
              <p className="text-[11.5px] text-zinc-500 mb-2">Live values from the sizing engine for the design above.</p>
              <table className="w-full text-[12.5px] border-collapse">
                <tbody className="divide-y divide-zinc-800/80">
                  {lesson.math(scenario, config).map((row, i) => (
                    <tr key={i}>
                      <td className={`py-2 pr-3 align-top whitespace-nowrap ${row.strong ? 'text-zinc-100 font-medium' : 'text-zinc-400'}`}>{row.label}</td>
                      <td className="py-2 pr-3 align-top text-zinc-400 font-mono text-[11.5px]">{row.expr}</td>
                      <td className={`py-2 align-top text-right whitespace-nowrap tabular-nums ${row.strong ? 'text-zinc-50 font-semibold' : 'text-zinc-200'}`}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section aria-label="Results" className="border-l border-zinc-800 overflow-y-auto p-5 space-y-3 bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${scenario.memory.isOOM ? 'bg-red-400' : 'bg-emerald-400'}`} />
          <span className="text-[13px] font-medium text-zinc-100">{scenario.memory.isOOM ? 'Does not fit' : 'Fits in memory'}</span>
          <span className="text-[11px] text-zinc-500 ml-auto truncate">{scenario.gpu.name}</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5">
          {lesson.metrics.map(id => <MetricTile key={id} id={id} scenario={scenario} config={config} highlighted={highlight.has(id)} />)}
        </div>
      </section>
    </div>
  );
}
