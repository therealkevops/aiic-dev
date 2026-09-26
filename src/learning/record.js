// The learning record: a summary of this browser's progress that a solutions architect can
// print or save and share. It is self-reported (progress lives only in this browser), and says so.
import { CATALOG, CORE, PRODUCTION } from './catalog.js';
import { LESSONS } from './lessons.js';

export const PASS_PCT = LESSONS.capstone.steps.find(s => s.kind === 'quiz').passPct;

export function recordSummary(progress) {
  const done = (l) => !!progress.completed[l.id];
  const quizBest = progress.quiz.capstone?.best ?? null;
  const coreDone = CORE.filter(done).length;
  return {
    coreDone,
    coreTotal: CORE.length,
    productionDone: PRODUCTION.filter(done).length,
    productionTotal: PRODUCTION.length,
    quizBest,
    quizPassed: quizBest != null && quizBest >= PASS_PCT,
    // The core path counts as complete when every core lesson is finished and the quiz passed.
    pathComplete: coreDone === CORE.length && quizBest != null && quizBest >= PASS_PCT,
    lessons: CATALOG.map(l => ({ ...l, completedOn: typeof progress.completed[l.id] === 'string' ? progress.completed[l.id] : null, done: done(l) })),
  };
}

const esc = (v) => String(v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/** A standalone, printable HTML page of the record. */
export function buildRecordHtml(progress, today = new Date().toISOString().slice(0, 10)) {
  const r = recordSummary(progress);
  const name = progress.name?.trim() || 'Name not entered';
  const row = (l) => `<tr><td>${l.number}</td><td>${esc(l.title)}</td><td>${l.done ? `Completed${l.completedOn ? ` ${l.completedOn}` : ''}` : 'Not completed'}</td></tr>`;
  const status = r.pathComplete
    ? 'Core path complete'
    : `Core path in progress (${r.coreDone} of ${r.coreTotal} lessons${r.quizBest != null ? `, best quiz score ${r.quizBest}%` : ''})`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learning record: ${esc(name)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #18181b; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0; } h2 { font-size: 15px; margin: 28px 0 8px; }
  .muted { color: #52525b; font-size: 13px; } .status { margin-top: 16px; padding: 12px 14px; border: 1px solid #d4d4d8; border-radius: 8px; }
  .status strong { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; } td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e4e4e7; }
  th { color: #52525b; font-weight: 600; } td:first-child { width: 2em; color: #71717a; }
  .note { margin-top: 28px; font-size: 12px; color: #71717a; }
</style></head><body>
<p class="muted">AI Infrastructure Sizer · Learning mode</p>
<h1>Learning record: ${esc(name)}</h1>
<p class="muted">Generated ${today}</p>
<div class="status"><strong>${status}</strong>
${r.quizBest != null ? `Capstone quiz: best score ${r.quizBest}% (pass mark ${PASS_PCT}%)${r.quizPassed ? ', passed' : ''}.<br>` : ''}
Production topics: ${r.productionDone} of ${r.productionTotal} completed.</div>
<h2>Core path</h2>
<table><thead><tr><th>#</th><th>Lesson</th><th>Status</th></tr></thead><tbody>
${r.lessons.filter(l => l.track === 'core').map(row).join('\n')}
</tbody></table>
<h2>Production topics</h2>
<table><thead><tr><th>#</th><th>Lesson</th><th>Status</th></tr></thead><tbody>
${r.lessons.filter(l => l.track === 'production').map(row).join('\n')}
</tbody></table>
<p class="note">Self-reported record of lessons completed in one browser. Each lesson has the learner size a design with the calculator's engine, predict results before seeing them, and complete tasks that check the design; the capstone ends with a scored quiz. This is not a verified certification.</p>
</body></html>`;
}
