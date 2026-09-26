import React from 'react';
import { GraduationCap } from 'lucide-react';
import { CATALOG } from '../../learning/catalog';

// Advanced-mode tab → the lesson that teaches it.
const TAB_LESSON = {
  workload: 'memory',
  platform: 'speed',
  sharding: 'sharding',
  network: 'network',
  facility: 'facility',
  storage: 'training',
  rag: 'rag',
  stack: 'serving',
  guardrails: 'guardrails',
  hadr: 'resilience',
  sla: 'traffic',
  cost: 'cost',
  planning: 'cost',
};

export function LearnLink({ tabId, navigate }) {
  const lesson = CATALOG.find(l => l.id === TAB_LESSON[tabId]);
  if (!lesson) return null;
  return (
    <button
      type="button"
      data-testid="learn-link"
      onClick={() => navigate({ page: 'learn', lessonId: lesson.id })}
      className="w-full flex items-center gap-2 text-left text-[11.5px] text-zinc-500 hover:text-zinc-200 cursor-pointer"
    >
      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
      <span>New to this? <span className="text-sky-400">Lesson {lesson.number}: {lesson.title}</span></span>
    </button>
  );
}
