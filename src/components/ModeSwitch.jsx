import React from 'react';
import { GraduationCap, SlidersHorizontal } from 'lucide-react';

// Learning / Advanced switch shown in both modes' headers.
export function ModeSwitch({ mode, onChange }) {
  const opts = [
    { id: 'learn', label: 'Learning', icon: GraduationCap },
    { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
  ];
  return (
    <div role="tablist" aria-label="Mode" className="inline-flex h-8 p-0.5 rounded-md border border-zinc-800 bg-zinc-900 shrink-0">
      {opts.map(o => {
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={`mode-${o.id}`}
            onClick={() => !active && onChange(o.id)}
            title={`${o.label} mode`}
            className={`inline-flex items-center gap-1.5 px-2.5 rounded text-xs font-medium transition cursor-pointer ${
              active ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <o.icon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Product mark and name; returns to the home page.
export function ProductMark({ onHome, Icon, tagline }) {
  return (
    <button type="button" data-testid="go-home" onClick={onHome} title="Home" className="flex items-center gap-2.5 shrink-0 text-left cursor-pointer">
      <div className="w-7 h-7 rounded-md bg-sky-600 text-white flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-white whitespace-nowrap">AI Infrastructure Sizer</div>
        {tagline && <div className="text-[10.5px] text-zinc-500 whitespace-nowrap hidden 2xl:block">{tagline}</div>}
      </div>
    </button>
  );
}
