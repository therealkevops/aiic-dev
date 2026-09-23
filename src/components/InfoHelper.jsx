import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

export function InfoHelper({ title, text, whyItMatters }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="text-xs mt-1 text-zinc-400">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors font-medium cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>What is this?</span>
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="mt-1.5 p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 space-y-1.5 leading-relaxed animate-fadeIn">
          {title && <div className="font-semibold text-zinc-100">{title}</div>}
          <div className="text-zinc-400">{text}</div>
          {whyItMatters && (
            <div className="pt-1.5 border-t border-zinc-800 text-zinc-300 text-[11px]">
              <span className="font-semibold text-sky-400">Decision rule: </span>
              {whyItMatters}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GlossaryCard({ term, definition, impact }) {
  return (
    <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs">
      <div className="font-bold text-zinc-100 text-sm mb-1">{term}</div>
      <p className="text-zinc-400 mb-1.5 leading-relaxed">{definition}</p>
      {impact && (
        <div className="text-zinc-400 text-[11px] pt-1 border-t border-zinc-800/80">
          <strong className="text-sky-400 font-medium">Impact: </strong>{impact}
        </div>
      )}
    </div>
  );
}
