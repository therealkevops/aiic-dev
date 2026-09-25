import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Shared UI primitives for the sizing calculator.
 * Goal: one card-nesting level, consistent type scale, tabular numbers for data,
 * label/value rows instead of cramped multi-column grids.
 */

// ---------- Card ----------
export function Card({ icon: Icon, title, right, children, className = '', tight = false }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl ${tight ? 'p-3' : 'p-4'} ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between gap-3 pb-2.5 mb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-4 h-4 text-sky-400 shrink-0" />}
            {typeof title === 'string' ? (
              <span className="font-semibold text-[13px] text-zinc-100 truncate">{title}</span>
            ) : title}
          </div>
          {right && <div className="shrink-0 text-xs">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------- Disclosure (accordion) ----------
export function Disclosure({ title, icon: Icon, right, defaultOpen = false, children, className = '' }) {
  return (
    <details open={defaultOpen} className={`group bg-zinc-900 border border-zinc-800 rounded-xl ${className}`}>
      <summary className="cursor-pointer select-none flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-sky-400 shrink-0" />}
          <span className="font-semibold text-[13px] text-zinc-100 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right && <span className="text-[11px] text-zinc-400 font-mono">{right}</span>}
          <ChevronDown className="chev w-4 h-4 text-zinc-500" />
        </div>
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-zinc-800/70">
        {children}
      </div>
    </details>
  );
}

// ---------- Section label (small uppercase eyebrow above a group) ----------
export function SectionLabel({ children }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-0.5">
      {children}
    </div>
  );
}

// ---------- KPI scoreboard ----------
export function KpiRow({ children }) {
  return (
    <div className="grid gap-px bg-zinc-800 border border-zinc-800 rounded-xl overflow-hidden" style={{ gridTemplateColumns: `repeat(${React.Children.count(children)}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

const KPI_TONES = {
  neutral: 'text-zinc-100',
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  danger: 'text-red-400',
  accent: 'text-sky-400',
};

export function Kpi({ label, value, sub, tone = 'neutral', stripe }) {
  return (
    <div className={`bg-zinc-900 px-3 py-2.5 min-w-0 ${stripe ? `border-l-2 ${stripe}` : ''}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 truncate">{label}</div>
      <div className={`text-lg font-semibold font-mono tabular-nums leading-tight mt-0.5 truncate ${KPI_TONES[tone]}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

// ---------- Label / value row list ----------
export function Rows({ children, className = '' }) {
  return <div className={`flex flex-col ${className}`}>{children}</div>;
}

export function Row({ k, v, tone = 'neutral', mono = true }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-zinc-800/60 last:border-b-0 text-[12.5px]">
      <span className="text-zinc-400">{k}</span>
      <span className={`text-right ${mono ? 'font-mono' : ''} ${KPI_TONES[tone]}`}>{v}</span>
    </div>
  );
}

// ---------- Banners ----------
const BANNER_TONES = {
  good: { wrap: 'bg-emerald-950/40 border-emerald-800 text-emerald-200', icon: 'text-emerald-400' },
  warn: { wrap: 'bg-amber-950/40 border-amber-800 text-amber-200', icon: 'text-amber-400' },
  danger: { wrap: 'bg-red-950/40 border-red-900 text-red-200', icon: 'text-red-400' },
  info: { wrap: 'bg-sky-950/30 border-sky-900 text-sky-200', icon: 'text-sky-400' },
};

export function Banner({ tone = 'info', icon: Icon, title, children }) {
  const t = BANNER_TONES[tone];
  return (
    <div className={`p-3.5 rounded-xl border ${t.wrap}`}>
      <div className="flex items-start gap-2.5">
        {Icon && <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${t.icon}`} />}
        <div className="space-y-1.5 flex-1 min-w-0">
          {title && <div className="font-semibold text-[13px]">{title}</div>}
          {children && <div className="text-[12px] leading-relaxed opacity-90">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// ---------- Meter (stacked allocation bar) ----------
export function Meter({ segments, capacity, className = '' }) {
  return (
    <div className={className}>
      <div className="h-5 w-full bg-zinc-950 rounded-md overflow-hidden flex gap-0.5 p-0.5 border border-zinc-800">
        {segments.filter(s => s.value > 0).map((s, i) => (
          <div
            key={i}
            style={{ width: `${Math.min(100, (s.value / capacity) * 100)}%` }}
            className={`rounded-sm min-w-[2px] transition-opacity hover:opacity-80 ${s.color}`}
            title={`${s.label}: ${s.display}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11.5px]">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-sm shrink-0 ${s.color}`} />
            <span className="text-zinc-400">{s.label} <strong className="text-zinc-200 font-mono font-medium">{s.display}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Segmented toggle (2-3 option pill) ----------
// For a genuine multi-way mode choice (e.g. "Owned Datacenter" vs "Colocation"). Segments are
// always equal-width regardless of label length, so it never looks lopsided. For a plain
// on/off setting, prefer Switch/ToggleRow below instead -- a two-button segmented control
// reads as heavier UI than a boolean setting needs.
export function SegmentedToggle({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex p-0.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1 rounded-md transition cursor-pointer whitespace-nowrap text-center ${
            value === opt.value ? 'bg-sky-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Switch (boolean on/off) ----------
export function Switch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full shrink-0 transition-colors ${
        disabled ? 'bg-zinc-800 cursor-not-allowed' : checked ? 'bg-sky-600 cursor-pointer' : 'bg-zinc-700 cursor-pointer'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ---------- Toggle row (label + description on the left, Switch on the right) ----------
// The standard "settings row" pattern for a boolean setting -- pairs a Switch with its label
// and an optional one-line description, instead of cramming both into segmented-toggle labels.
export function ToggleRow({ label, description, checked, onChange, disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <div className="min-w-0">
        <div className="text-xs font-medium text-zinc-300">{label}</div>
        {description && <div className="text-[10.5px] text-zinc-500 mt-0.5">{description}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ---------- Field wrapper (label + control) ----------
export function Field({ label, children, helper }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-zinc-300 mb-1.5">{label}</label>}
      {children}
      {helper}
    </div>
  );
}

// ---------- Slider field (label/value header + range input + min/max caption) ----------
const SLIDER_ACCENTS = {
  sky: { text: 'text-sky-400', input: 'accent-sky-500' },
  amber: { text: 'text-amber-400', input: 'accent-amber-500' },
  emerald: { text: 'text-emerald-400', input: 'accent-emerald-500' },
};

export function SliderField({ label, valueLabel, min, max, step, value, onChange, accent = 'sky', marks, helper }) {
  const a = SLIDER_ACCENTS[accent] || SLIDER_ACCENTS.sky;
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1.5">
        <span className="font-medium text-zinc-300">{label}</span>
        <span className={`font-semibold font-mono ${a.text}`}>{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className={`w-full ${a.input} bg-zinc-800 h-1.5 rounded-lg cursor-pointer`}
      />
      {marks && (
        <div className="flex justify-between text-[10.5px] text-zinc-500 mt-1">
          {marks.map((m, i) => <span key={i}>{m}</span>)}
        </div>
      )}
      {helper}
    </div>
  );
}

// ---------- Scale field (wide-dynamic-range control: preset chips + exact numeric input) ----------
// For quantities that span orders of magnitude (concurrency, DP replicas) where a linear
// slider is either too coarse at the low end or unusable at the high end.
export function ScaleField({ label, value, onChange, presets, min = 1, max = 100000, suffix = '', helper }) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1.5">
        <span className="font-medium text-zinc-300">{label}</span>
        <span className="font-semibold font-mono text-sky-400">{value.toLocaleString()}{suffix}</span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${presets.length}, minmax(0, 1fr))` }}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
              value === p ? 'bg-sky-600 border-sky-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {p.toLocaleString()}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
          className="w-24 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
        />
        <span className="text-[10.5px] text-zinc-500">exact value ({min.toLocaleString()}–{max.toLocaleString()})</span>
      </div>
      {helper}
    </div>
  );
}

// ---------- Choice grid (clickable option cards) ----------
export function ChoiceCard({ selected, onClick, title, titleColor = 'text-white', desc, badge, columns = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2.5 rounded-lg border text-left transition cursor-pointer w-full ${
        selected
          ? 'bg-zinc-800 border-sky-500 text-white ring-1 ring-sky-500/30'
          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-semibold text-xs ${selected ? titleColor : 'text-inherit'}`}>{title}</span>
        {badge}
      </div>
      {desc && <div className="text-[10.5px] text-zinc-400 mt-1 leading-normal">{desc}</div>}
    </button>
  );
}

export function Tag({ tone = 'neutral', children, mono = true }) {
  const tones = {
    neutral: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    accent: 'bg-sky-950 text-sky-300 border-sky-800/60',
    good: 'bg-emerald-950 text-emerald-300 border-emerald-800/60',
    warn: 'bg-amber-950 text-amber-300 border-amber-800/60',
    danger: 'bg-red-950 text-red-300 border-red-800/60',
  };
  return (
    <span className={`text-[10.5px] px-1.5 py-0.5 rounded border ${mono ? 'font-mono' : ''} ${tones[tone]}`}>
      {children}
    </span>
  );
}
