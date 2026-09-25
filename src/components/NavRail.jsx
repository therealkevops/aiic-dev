import React from 'react';

function NavItem({ tab, number, active, onSelect }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      data-testid={`nav-${tab.id}`}
      onClick={() => onSelect(tab.id)}
      aria-current={active ? 'page' : undefined}
      className={`relative w-full text-left pl-3 pr-2 py-1.5 rounded-md transition cursor-pointer flex items-center gap-2.5 ${
        active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
      }`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sky-400" />}
      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-sky-400' : 'text-zinc-500'}`} />
      <div className="flex-1 min-w-0 leading-tight">
        <div className="text-xs font-medium truncate">
          <span className="text-zinc-500 tabular-nums mr-1">{number}.</span>{tab.label}
        </div>
        <div data-nav-meta className="text-[10.5px] text-zinc-500 truncate">{tab.meta}</div>
      </div>
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-0.5">
      <div className="px-3 pt-3 pb-1 text-[10.5px] font-medium text-zinc-500">{title}</div>
      {children}
    </div>
  );
}

export function NavRail({ ctx }) {
  const { activeInputTab, economicsNavTabs, setActiveInputTab, technicalNavTabs } = ctx;
  return (
    <nav aria-label="Calculator sections" className="w-56 shrink-0 bg-zinc-950 border-r border-zinc-800 overflow-y-auto px-2 pb-3">
      <Section title="Configuration">
        {technicalNavTabs.map((t, i) => (
          <NavItem key={t.id} tab={t} number={i + 1} active={activeInputTab === t.id} onSelect={setActiveInputTab} />
        ))}
      </Section>
      <Section title="Performance & economics">
        {economicsNavTabs.map((t, i) => (
          <NavItem key={t.id} tab={t} number={technicalNavTabs.length + i + 1} active={activeInputTab === t.id} onSelect={setActiveInputTab} />
        ))}
      </Section>
    </nav>
  );
}
