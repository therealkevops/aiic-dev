import React, { useState } from 'react';

export function InfoHelper({ title, text, whyItMatters }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="text-xs mt-1 text-zinc-400">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="What is this?"
        title="What is this?"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 text-sky-400 hover:text-sky-300 hover:border-sky-500 transition-colors font-bold text-[10px] leading-none cursor-pointer"
      >
        ?
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
