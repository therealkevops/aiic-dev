import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Award, ArrowRight, BookOpen, Check, CheckCircle2, ChevronDown, Lightbulb, RotateCcw, SlidersHorizontal, Target, X } from 'lucide-react';
import { computeScenario } from '../../utils/scenario';
import { CATALOG, lessonPosition } from '../../learning/catalog';
import { CONTROLS, LESSONS, METRICS, controlId, controlOptions, controlSet, controlValue } from '../../learning/lessons';
import { loadProgress, saveProgress } from '../../learning/progress';
import { BREAKPOINTS, useMinWidth } from '../../state/useMediaQuery';

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

function OpenDesign({ onClick }) {
  return (
    <button type="button" data-testid="open-design" onClick={onClick} className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-800 bg-sky-500/10 text-sm text-sky-200 cursor-pointer">
      <SlidersHorizontal className="w-4 h-4" /> Open the Design tab
    </button>
  );
}

function TaskStep({ step, complete, onOpenDesign }) {
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
          <div className="mt-2 space-y-2">
            {onOpenDesign && <OpenDesign onClick={onOpenDesign} />}
            {hint
              ? <p className="text-[12px] text-zinc-400">{step.hint}</p>
              : <button type="button" onClick={() => setHint(true)} className="text-[12px] text-sky-400 hover:underline cursor-pointer inline-flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" />Show a hint</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function BriefStep({ step, config, scenario, onOpenDesign }) {
  const [hint, setHint] = useState(false);
  const results = step.requirements.map(r => ({ ...r, ok: r.check(config, scenario), value: r.show(scenario, config) }));
  const allOk = results.every(r => r.ok);
  return (
    <div className="space-y-3">
      <Paragraphs text={step.body} />
      {onOpenDesign && !allOk && <OpenDesign onClick={onOpenDesign} />}
      <ul className="rounded-md border border-zinc-800 divide-y divide-zinc-800" data-testid="brief-checklist">
        {results.map((r, i) => (
          <li key={i} className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]">
            {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <X className="w-4 h-4 text-red-400 shrink-0" />}
            <span className="text-zinc-200 flex-1">{r.label}</span>
            <span className={`tabular-nums ${r.ok ? 'text-zinc-400' : 'text-red-300'}`}>{r.value}</span>
          </li>
        ))}
      </ul>
      {allOk ? (
        <div className="rounded-md border border-emerald-700 bg-emerald-500/5 p-3 text-[12.5px] text-zinc-300 leading-relaxed" data-testid="brief-met">
          <span className="font-medium text-emerald-300">Brief met. </span>{step.done}
        </div>
      ) : hint
        ? <p className="text-[12px] text-zinc-400">{step.hint}</p>
        : <button type="button" onClick={() => setHint(true)} className="text-[12px] text-sky-400 hover:underline cursor-pointer inline-flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" />Show a hint</button>}
    </div>
  );
}

function QuizStep({ step, state, onChange, onSubmit }) {
  const picks = state?.picks || {};
  const submitted = !!state?.submitted;
  const answered = step.questions.every((_, i) => picks[i] != null);
  const correct = step.questions.filter((q, i) => picks[i] === q.answer).length;
  const pct = Math.round((correct / step.questions.length) * 100);
  return (
    <div className="space-y-4">
      <Paragraphs text={step.body} />
      {submitted && (
        <div className={`rounded-md border p-3 ${pct >= step.passPct ? 'border-emerald-700 bg-emerald-500/5' : 'border-amber-700 bg-amber-500/5'}`} data-testid="quiz-score">
          <div className="text-[15px] font-semibold text-zinc-50 tabular-nums">{correct} of {step.questions.length} ({pct}%)</div>
          <div className={`text-[12.5px] ${pct >= step.passPct ? 'text-emerald-300' : 'text-amber-300'}`}>
            {pct >= step.passPct ? 'Passed.' : `Not yet: ${step.passPct}% passes. Review the explanations and retake it.`}
          </div>
          <button type="button" data-testid="quiz-retake" onClick={() => onChange({ picks: {}, submitted: false })} className="mt-2 text-[12px] text-sky-400 hover:underline cursor-pointer inline-flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Retake
          </button>
        </div>
      )}
      <ol className="space-y-4" data-testid="quiz">
        {step.questions.map((q, i) => (
          <li key={i} className="space-y-1.5">
            <div className="text-[13px] text-zinc-100"><span className="text-zinc-500 tabular-nums mr-1">{i + 1}.</span>{q.q}</div>
            <div className="grid gap-1" role="radiogroup" aria-label={q.q}>
              {q.options.map((o, j) => {
                const chosen = picks[i] === j;
                const tone = !submitted
                  ? (chosen ? 'border-sky-500 bg-sky-500/10 text-zinc-50' : 'border-zinc-800 hover:border-zinc-600 text-zinc-300')
                  : j === q.answer ? 'border-emerald-700 bg-emerald-500/10 text-emerald-200'
                    : chosen ? 'border-red-800 bg-red-500/10 text-red-200' : 'border-zinc-800 text-zinc-500';
                return (
                  <button
                    key={j}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    data-testid={`quiz-${i}-${j}`}
                    disabled={submitted}
                    onClick={() => onChange({ picks: { ...picks, [i]: j }, submitted: false })}
                    className={`text-left px-2.5 py-1.5 rounded-md border text-[12.5px] ${submitted ? 'cursor-default' : 'cursor-pointer'} ${tone}`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {submitted && <p className="text-[11.5px] text-zinc-400">{q.explain}</p>}
          </li>
        ))}
      </ol>
      {!submitted && (
        <button
          type="button"
          data-testid="quiz-submit"
          disabled={!answered}
          onClick={() => onSubmit({ picks, submitted: true }, pct)}
          className="h-9 w-full rounded-md bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-default cursor-pointer"
        >
          {answered ? 'Submit answers' : `Answer all ${step.questions.length} questions to submit`}
        </button>
      )}
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
  const xl = useMinWidth(BREAKPOINTS.xl);
  const lg = useMinWidth(BREAKPOINTS.lg);
  const [tab, setTab] = useState('lesson');
  const openDesign = lg ? null : () => setTab('design');
  const goStep = (i) => { setStepIdx(Math.max(0, Math.min(lesson.steps.length - 1, i))); setTab('lesson'); };

  const base = useMemo(() => lesson.start(), [lesson]);
  const config = useMemo(() => ({ ...base, ...values }), [base, values]);
  const scenario = useMemo(() => computeScenario(config), [config]);
  const step = lesson.steps[stepIdx];
  const taskDone = (step.kind === 'task' && step.check(config, scenario))
    || (step.kind === 'brief' && step.requirements.every(r => r.check(config, scenario)));
  const canAdvance = step.kind === 'read' || step.kind === 'recap' || (step.kind === 'predict' && answers[stepIdx] != null)
    || (step.kind === 'quiz' && answers[stepIdx]?.submitted) || taskDone;
  const submitQuiz = (state, pct) => {
    setAnswers(a => ({ ...a, [stepIdx]: state }));
    const p = loadProgress();
    const prev = p.quiz[lessonId] || {};
    saveProgress({ ...p, quiz: { ...p.quiz, [lessonId]: { last: pct, best: Math.max(prev.best || 0, pct) } } });
  };
  const highlight = new Set(step.highlight || []);
  const watched = (step.highlight || []).find(id => lesson.metrics.includes(id));

  useEffect(() => {
    const p = loadProgress();
    saveProgress({ ...p, lastLessonId: lessonId, steps: { ...p.steps, [lessonId]: { step: stepIdx, values, answers } } });
  }, [lessonId, stepIdx, values, answers]);

  const finish = () => {
    const p = loadProgress();
    saveProgress({ ...p, completed: { ...p.completed, [lessonId]: new Date().toISOString().slice(0, 10) } });
    setFinished(true);
  };
  const next = CATALOG.find(l => l.number === meta.number + 1);
  const nextReady = next && LESSONS[next.id];

  const stepsHeader = (
        <div className="px-4 sm:px-5 pt-5 pb-4 border-b border-zinc-800">
          <div className="text-[11px] text-zinc-500">{lessonPosition(meta)}</div>
          <h1 className="text-[17px] font-semibold text-white mt-0.5 leading-snug">{meta.title}</h1>
          <p className="text-[12.5px] text-zinc-400 mt-1.5 leading-relaxed">{lesson.objective}</p>
          <div className="mt-3 flex gap-1" aria-hidden="true">
            {lesson.steps.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < stepIdx ? 'bg-sky-600' : i === stepIdx ? 'bg-sky-400' : 'bg-zinc-800'}`} />
            ))}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1.5 tabular-nums">Step {stepIdx + 1} of {lesson.steps.length}</div>
        </div>
  );
  const stepBody = (
        <div className="px-4 sm:px-5 py-5 flex-1 space-y-4" data-testid="lesson-step">
          <h2 className="text-[15px] font-semibold text-zinc-100">{step.title}</h2>
          {step.kind === 'read' && <Paragraphs text={step.body} />}
          {step.kind === 'predict' && (
            <PredictStep step={step} chosen={answers[stepIdx]} onChoose={(i) => setAnswers(a => ({ ...a, [stepIdx]: i }))} />
          )}
          {step.kind === 'task' && <TaskStep key={stepIdx} step={step} complete={taskDone} onOpenDesign={openDesign} />}
          {step.kind === 'brief' && <BriefStep key={stepIdx} step={step} config={config} scenario={scenario} onOpenDesign={openDesign} />}
          {step.kind === 'quiz' && (
            <QuizStep step={step} state={answers[stepIdx]} onChange={(st) => setAnswers(a => ({ ...a, [stepIdx]: st }))} onSubmit={submitQuiz} />
          )}
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
                    {lessonId === 'capstone' && (
                      <button type="button" data-testid="view-record" onClick={() => navigate({ page: 'learn', lessonId: 'record' })} className="h-9 inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-800 hover:bg-emerald-500/10 text-sm text-emerald-200 cursor-pointer">
                        <Award className="w-4 h-4" /> View your learning record
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
  );
  const navFooter = (
        <div className="px-4 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-zinc-800 flex items-center justify-between gap-3 bg-zinc-950">
          <button
            type="button"
            onClick={() => goStep(stepIdx - 1)}
            disabled={stepIdx === 0}
            className="h-10 lg:h-8 inline-flex items-center gap-1 px-2.5 rounded-md text-sm lg:text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          {!lg && watched && (
            <span className="flex-1 min-w-0 text-center text-[11.5px] text-zinc-400 truncate" data-testid="watched-metric">
              {METRICS[watched].label}: <span className="text-zinc-100 font-medium tabular-nums">{METRICS[watched].format(METRICS[watched].value(scenario, config), scenario, config)}</span>
            </span>
          )}
          {step.kind === 'recap' ? (
            !finished && (
              <button type="button" data-testid="finish-lesson" onClick={finish} className="h-10 lg:h-8 inline-flex items-center gap-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm lg:text-xs font-medium text-white cursor-pointer">
                <Check className="w-3.5 h-3.5" /> Finish lesson
              </button>
            )
          ) : (
            <button
              type="button"
              data-testid="next-step"
              onClick={() => goStep(stepIdx + 1)}
              disabled={!canAdvance}
              title={canAdvance ? undefined : step.kind === 'task' || step.kind === 'brief' ? 'Complete the task to continue' : step.kind === 'quiz' ? 'Submit the quiz to continue' : 'Choose an answer to continue'}
              className="h-10 lg:h-8 inline-flex items-center gap-1 px-4 lg:px-3 rounded-md bg-sky-600 hover:bg-sky-500 text-sm lg:text-xs font-medium text-white disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-default cursor-pointer"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
  );
  const designPanel = (
    <>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 space-y-4">
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
    </>
  );
  const resultsPanel = (
    <>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${scenario.memory.isOOM ? 'bg-red-400' : 'bg-emerald-400'}`} />
          <span className="text-[13px] font-medium text-zinc-100">{scenario.memory.isOOM ? 'Does not fit' : 'Fits in memory'}</span>
          <span className="text-[11px] text-zinc-500 ml-auto truncate">{scenario.gpu.name}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2.5">
          {lesson.metrics.map(id => <MetricTile key={id} id={id} scenario={scenario} config={config} highlighted={highlight.has(id)} />)}
        </div>
    </>
  );

  // Three columns from xl, two from lg (design above results), tabs below lg.
  if (xl) {
    return (
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(340px,400px)_1fr_minmax(300px,360px)]">
        <section aria-label="Lesson steps" className="border-r border-zinc-800 overflow-y-auto flex flex-col">
          {stepsHeader}{stepBody}{navFooter}
        </section>
        <section aria-label="Design" className="overflow-y-auto p-6 space-y-5">{designPanel}</section>
        <section aria-label="Results" className="border-l border-zinc-800 overflow-y-auto p-5 space-y-3 bg-zinc-950">{resultsPanel}</section>
      </div>
    );
  }
  if (lg) {
    return (
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(320px,380px)_1fr]">
        <section aria-label="Lesson steps" className="border-r border-zinc-800 overflow-y-auto flex flex-col">
          {stepsHeader}{stepBody}{navFooter}
        </section>
        <div className="overflow-y-auto p-5 space-y-5">
          <section aria-label="Design" className="space-y-5">{designPanel}</section>
          <section aria-label="Results" className="space-y-3">{resultsPanel}</section>
        </div>
      </div>
    );
  }
  const tabs = [{ id: 'lesson', label: 'Lesson' }, { id: 'design', label: 'Design' }, { id: 'results', label: 'Results' }];
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div role="tablist" aria-label="Lesson view" className="shrink-0 grid grid-cols-3 gap-1 p-1.5 border-b border-zinc-800 bg-zinc-950">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-testid={`lesson-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`h-10 rounded-md text-sm font-medium cursor-pointer ${tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'lesson' && <section aria-label="Lesson steps" className="flex flex-col">{stepsHeader}{stepBody}</section>}
        {tab === 'design' && <section aria-label="Design" className="p-3 sm:p-5 space-y-4">{designPanel}</section>}
        {tab === 'results' && <section aria-label="Results" className="p-3 sm:p-5 space-y-3">{resultsPanel}</section>}
      </div>
      {navFooter}
    </div>
  );
}
