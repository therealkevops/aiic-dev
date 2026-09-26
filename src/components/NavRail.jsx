import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// variant 'rail': the side rail (icons only from lg, labels from xl).
// variant 'drawer': the slide-out menu used below lg, always labelled, with larger touch targets.
function NavItem({ tab, number, active, onSelect, drawer }) {
  const Icon = tab.icon;
  const label = drawer ? '' : 'hidden xl:block';
  return (
    <button
      type="button"
      data-testid={`nav-${tab.id}`}
      onClick={() => onSelect(tab.id)}
      aria-current={active ? 'page' : undefined}
      title={drawer ? undefined : `${number}. ${tab.label} · ${tab.meta}`}
      className={`relative w-full text-left rounded-md transition cursor-pointer flex items-center ${
        drawer ? 'pl-3 pr-2 py-2.5 gap-3' : 'justify-center xl:justify-start px-0 xl:pl-3 xl:pr-2 py-2 xl:py-1.5 gap-2.5'
      } ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sky-400" />}
      <Icon className={`${drawer ? 'w-4 h-4' : 'w-4 h-4 xl:w-3.5 xl:h-3.5'} shrink-0 ${active ? 'text-sky-400' : 'text-zinc-500'}`} />
      <div className={`flex-1 min-w-0 leading-tight ${label}`}>
        <div className={`${drawer ? 'text-sm' : 'text-xs'} font-medium truncate`}>
          <span className="text-zinc-500 tabular-nums mr-1">{number}.</span>{tab.label}
        </div>
        <div data-nav-meta className={`${drawer ? 'text-xs' : 'text-[10.5px]'} text-zinc-500 truncate`}>{tab.meta}</div>
      </div>
    </button>
  );
}

function Section({ title, children, drawer }) {
  return (
    <div className="space-y-0.5">
      <div className={`px-3 pt-3 pb-1 text-[10.5px] font-medium text-zinc-500 ${drawer ? '' : 'hidden xl:block'}`}>{title}</div>
      {!drawer && <div className="xl:hidden mx-2 my-2 border-t border-zinc-800" />}
      {children}
    </div>
  );
}

function Items({ ctx, drawer, onSelect }) {
  const { activeInputTab, economicsNavTabs, technicalNavTabs } = ctx;
  return (
    <>
      <Section title="Configuration" drawer={drawer}>
        {technicalNavTabs.map((t, i) => (
          <NavItem key={t.id} tab={t} number={i + 1} active={activeInputTab === t.id} onSelect={onSelect} drawer={drawer} />
        ))}
      </Section>
      <Section title="Performance & economics" drawer={drawer}>
        {economicsNavTabs.map((t, i) => (
          <NavItem key={t.id} tab={t} number={technicalNavTabs.length + i + 1} active={activeInputTab === t.id} onSelect={onSelect} drawer={drawer} />
        ))}
      </Section>
    </>
  );
}

export function NavRail({ ctx }) {
  return (
    <nav aria-label="Calculator sections" className="w-14 xl:w-56 shrink-0 bg-zinc-950 border-r border-zinc-800 overflow-y-auto px-1.5 xl:px-2 pb-3">
      <Items ctx={ctx} onSelect={ctx.setActiveInputTab} />
    </nav>
  );
}

/** Slide-out section menu for screens narrower than lg. */
export function NavDrawer({ ctx, open, onClose, onSelect }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Calculator sections">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <nav data-testid="nav-drawer" className="relative w-[min(20rem,85vw)] h-full bg-zinc-950 border-r border-zinc-800 overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="text-sm font-semibold text-white">Sections</span>
          <button type="button" onClick={onClose} aria-label="Close sections" className="w-10 h-10 -mr-2 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <Items ctx={ctx} drawer onSelect={onSelect} />
      </nav>
    </div>
  );
}
