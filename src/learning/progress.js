// Learning progress, kept in this browser only. Every read and write tolerates storage being
// unavailable (private windows, blocked site data): progress then lasts for the session.
const KEY = 'aiic.learning.v1';
// completed[id] is the date finished (YYYY-MM-DD), or true for lessons finished before dates were kept.
let memoryFallback = { completed: {}, steps: {}, quiz: {}, lastLessonId: null, name: '' };

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...memoryFallback };
    const p = JSON.parse(raw);
    return { completed: p.completed || {}, steps: p.steps || {}, quiz: p.quiz || {}, lastLessonId: p.lastLessonId || null, name: p.name || '' };
  } catch {
    return { ...memoryFallback };
  }
}

export function saveProgress(progress) {
  memoryFallback = progress;
  try { window.localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}
