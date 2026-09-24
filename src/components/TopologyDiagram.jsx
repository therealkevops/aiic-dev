import React, { useState } from 'react';
import {
  Server,
  ShieldCheck,
  Info,
  CheckCircle2
} from 'lucide-react';

// ---------- Layout helpers ----------

/** Shortens a switch/model string to fit a small diagram box: drops the vendor
 * prefix and any parenthetical, then hard-truncates with an ellipsis. */
function shortLabel(s, max = 20) {
  if (!s) return s;
  const core = s.split('(')[0].replace(/^Cisco\s+/, '').trim();
  return core.length > max ? `${core.slice(0, max - 1)}…` : core;
}

/** Evenly spaced, centered x-positions for `n` boxes of width `boxW` inside `totalWidth`. */
function centeredXs(n, totalWidth, boxW, gap = 18) {
  const span = n * boxW + (n - 1) * gap;
  const start = Math.max(8, (totalWidth - span) / 2);
  return Array.from({ length: n }, (_, i) => start + i * (boxW + gap));
}

/** A bus/trunk connector: verticals from each upper box down to a shared horizontal
 * trunk, then verticals from the trunk down into each lower box. Generalizes to any
 * box counts on either side without implying an exact per-port mapping. */
function FanLinks({ fromXs, y1, toXs, y2, label }) {
  const allXs = [...fromXs, ...toXs];
  const yMid = y1 + (y2 - y1) * 0.5;
  const trunkMinX = Math.min(...allXs);
  const trunkMaxX = Math.max(...allXs);
  return (
    <g>
      <g stroke="currentColor" strokeWidth="1" opacity="0.45">
        {fromXs.map((x, i) => <line key={`u${i}`} x1={x} y1={y1} x2={x} y2={yMid} />)}
        <line x1={trunkMinX} y1={yMid} x2={trunkMaxX} y2={yMid} />
      </g>
      <g stroke="currentColor" strokeWidth="1" opacity="0.7" markerEnd="url(#topo-arrow)">
        {toXs.map((x, i) => <line key={`d${i}`} x1={x} y1={yMid} x2={x} y2={y2 - 2} />)}
      </g>
      {label && (
        <text x={trunkMaxX + 10} y={yMid - 4} fontSize="10.5" fill="currentColor" opacity="0.6">
          {label}
        </text>
      )}
    </g>
  );
}

function TierBox({ x, y, w, h, title, sub, accent }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill="none" stroke="currentColor" opacity={accent ? '0.95' : '0.8'} />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 5 : -4)} textAnchor="middle" fontSize="11.5" fill="currentColor">
        {title}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6" fontFamily="IBM Plex Mono, ui-monospace, monospace">
          {sub}
        </text>
      )}
    </g>
  );
}

const VIEW_W = 720;
const BOX_W = 138;
const BOX_H = 42;
const ROW_GAP = 78;

export function TopologyDiagram({ results, gpu, platform, protocol }) {
  const { nodes, totalGpus, network, bom } = results;
  const isModular = platform && platform.isModular;
  const isMultiNode = nodes > 1;
  const gpusPerUnit = platform ? platform.gpusPerChassis : (gpu.gpusPerChassis || 8);

  const [viewMode, setViewMode] = useState(isMultiNode ? 'fabric' : 'chassis');

  // ---------- Build the fabric (multi-tier) diagram ----------
  const hasSpine = bom.spineSwitchCount > 0;
  const hasFabricInterconnect = isModular && !!bom.fabricInterconnectModel;
  const displayedSpine = Math.min(bom.spineSwitchCount, 4);
  const displayedLeaf = Math.min(bom.leafSwitchCount, 4);
  const displayedUnits = Math.min(nodes, 4);

  const tiers = [];
  if (hasSpine) {
    tiers.push({
      key: 'spine',
      label: 'Tier 1 · Spine',
      xs: centeredXs(displayedSpine, VIEW_W, BOX_W),
      boxes: Array.from({ length: displayedSpine }, (_, i) => ({
        title: `Spine #${i + 1}`,
        sub: shortLabel(bom.spineSwitchModel),
      })),
      linkLabel: '1:1 non-blocking uplinks',
    });
  }
  tiers.push({
    key: 'leaf',
    label: `Tier ${hasSpine ? 2 : 1} · Leaf`,
    xs: centeredXs(displayedLeaf, VIEW_W, BOX_W),
    boxes: Array.from({ length: displayedLeaf }, (_, i) => ({
      title: `Leaf #${i + 1}`,
      sub: shortLabel(bom.leafSwitchModel),
    })),
    linkLabel: !hasSpine ? 'Single-tier fabric — no spine required' : undefined,
  });
  if (hasFabricInterconnect) {
    tiers.push({
      key: 'fi',
      label: `Tier ${tiers.length + 1} · Fabric Interconnect`,
      xs: centeredXs(1, VIEW_W, BOX_W * 1.6),
      boxes: [{ title: bom.fabricInterconnectModel?.replace('Fabric Interconnects', 'FI').split('(')[0].trim(), sub: 'Cisco Intersight managed' }],
      linkLabel: undefined,
    });
  }
  tiers.push({
    key: 'compute',
    label: `Tier ${tiers.length + 1} · Compute`,
    xs: centeredXs(displayedUnits, VIEW_W, BOX_W),
    boxes: Array.from({ length: displayedUnits }, (_, i) => {
      const activeInUnit = Math.min(gpusPerUnit, Math.max(0, totalGpus - i * gpusPerUnit));
      return {
        title: isModular ? `Blade Pair #${i + 1}` : `${platform.shortName} #${i + 1}`,
        sub: `${activeInUnit}/${gpusPerUnit} GPUs active`,
      };
    }),
    linkLabel: `${gpusPerUnit} rail-dedicated link${gpusPerUnit > 1 ? 's' : ''} per chassis`,
  });

  const svgHeight = 24 + tiers.length * ROW_GAP + BOX_H + 10;

  // ---------- Chassis interior view ----------
  const interconnectLabel = isModular
    ? 'Cisco X-Fabric PCIe Gen5 midplane'
    : gpu.interconnectType === 'nvlink'
    ? `NVSwitch fabric — ${gpu.interconnect}, sub-microsecond all-reduce`
    : `PCIe dual-root interconnect — ${gpu.interconnect}`;

  const chassisGpuXs = centeredXs(gpusPerUnit, VIEW_W, Math.min(84, (VIEW_W - 40) / gpusPerUnit - 10), 10);
  const chassisGpuW = Math.min(84, (VIEW_W - 40) / gpusPerUnit - 10);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-sans space-y-4">

      {/* Header with View Toggle & Protocol Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <Server className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-semibold text-[13px] text-zinc-100">
            {isModular ? 'Cisco UCS X-Series Modular Architecture' : 'Cluster Topology & Hardware Schematic'}
          </span>
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono shrink-0">
            {bom.chassisCount} chassis · {totalGpus} GPUs
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex p-0.5 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
            {isMultiNode && (
              <button type="button" onClick={() => setViewMode('fabric')}
                className={`px-2.5 py-1 rounded transition font-medium cursor-pointer ${viewMode === 'fabric' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                Network fabric
              </button>
            )}
            <button type="button" onClick={() => setViewMode('chassis')}
              className={`px-2.5 py-1 rounded transition font-medium cursor-pointer ${viewMode === 'chassis' ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
              {isModular ? 'Blade & chassis view' : 'Chassis interior'}
            </button>
          </div>
          <span className="text-[10.5px] px-2 py-1 rounded bg-zinc-800 text-sky-400 border border-zinc-700 font-medium hidden md:inline-block">
            {protocol.name}
          </span>
        </div>
      </div>

      {/* ===================== VIEW 1: NETWORK FABRIC ===================== */}
      {viewMode === 'fabric' && isMultiNode && (
        <div className="space-y-3">
          <figure className="m-0">
            <svg viewBox={`0 0 ${VIEW_W} ${svgHeight}`} className="w-full h-auto text-zinc-500"
              role="img"
              aria-label={`${tiers.map(t => t.label).join(' feeding into ')} network topology for ${bom.chassisCount} chassis and ${totalGpus} GPUs.`}>
              <defs>
                <marker id="topo-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
                </marker>
              </defs>

              {tiers.map((tier, ti) => {
                const y = 24 + ti * ROW_GAP;
                const boxW = tier.key === 'fi' ? BOX_W * 1.6 : BOX_W;
                return (
                  <g key={tier.key}>
                    <text x="8" y={y - 8} fontSize="11" fill="currentColor" opacity="0.55">{tier.label}</text>
                    {tier.boxes.map((b, bi) => (
                      <TierBox key={bi} x={tier.xs[bi]} y={y} w={boxW} h={BOX_H} title={b.title} sub={b.sub} accent={tier.key === 'compute'} />
                    ))}
                    {ti > 0 && (
                      <FanLinks
                        fromXs={tiers[ti - 1].xs.map(x => x + (tiers[ti - 1].key === 'fi' ? BOX_W * 1.6 : BOX_W) / 2)}
                        y1={24 + (ti - 1) * ROW_GAP + BOX_H}
                        toXs={tier.xs.map(x => x + boxW / 2)}
                        y2={y}
                        label={tier.linkLabel}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            <figcaption className="text-[11.5px] text-zinc-400 leading-relaxed mt-2">
              {hasSpine
                ? `${bom.spineSwitchCount} spine switch${bom.spineSwitchCount > 1 ? 'es' : ''} give a non-blocking core over ${bom.leafSwitchCount} leaf switch${bom.leafSwitchCount > 1 ? 'es' : ''}; each chassis rides ${gpusPerUnit} rail-dedicated links so GPU-to-GPU traffic never shares a cable with another rail.`
                : `${bom.leafSwitchCount} leaf switch${bom.leafSwitchCount > 1 ? 'es' : ''} serve the full cluster directly — no spine tier is required at this scale.`}
            </figcaption>
          </figure>

          {nodes > displayedUnits && (
            <div className="text-[11px] text-zinc-400 bg-zinc-950/60 border border-dashed border-zinc-800 rounded-lg px-3 py-2">
              + {nodes - displayedUnits} additional identical compute unit{nodes - displayedUnits > 1 ? 's' : ''} on the same fabric.
            </div>
          )}

          {totalGpus < nodes * gpusPerUnit && (
            <div className="p-2.5 bg-amber-950/20 border border-amber-800/40 rounded-lg text-[11px] text-amber-200/90 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                This workload needs <strong>{totalGpus} GPUs</strong>; the physical hardware provides <strong>{nodes * gpusPerUnit} sockets</strong>, leaving <strong>{(nodes * gpusPerUnit) - totalGpus}</strong> free for other jobs.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11.5px] pt-1 border-t border-zinc-800/70">
            <div><span className="text-zinc-500">Bisection bandwidth</span><div className="font-mono text-zinc-200">{network.totalClusterBisectionTbps.toFixed(1)} Tbps</div></div>
            <div><span className="text-zinc-500">Leaf switches</span><div className="font-mono text-zinc-200">{bom.leafSwitchCount}x {bom.leafSwitchModel?.split(' ').slice(0, 2).join(' ')}</div></div>
            <div><span className="text-zinc-500">Spine switches</span><div className="font-mono text-zinc-200">{bom.spineSwitchCount > 0 ? `${bom.spineSwitchCount}x` : 'None'}</div></div>
            <div><span className="text-zinc-500">Topology</span><div className="font-mono text-zinc-200">1:1 non-blocking Clos</div></div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: CHASSIS INTERIOR ===================== */}
      {viewMode === 'chassis' && (
        <div className="space-y-3">
          <figure className="m-0">
            <svg viewBox={`0 0 ${VIEW_W} 210`} className="w-full h-auto text-zinc-500"
              role="img"
              aria-label={`Inside one ${platform.name}: host CPU and memory connect through ${interconnectLabel} to ${gpusPerUnit} ${gpu.name} GPUs, which connect out through ${gpusPerUnit} network adapters, one per GPU.`}>
              <defs>
                <marker id="topo-arrow-2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
                </marker>
              </defs>

              <rect x="8" y="8" width="230" height="40" rx="6" fill="none" stroke="currentColor" opacity="0.85" />
              <text x="123" y="24" textAnchor="middle" fontSize="11.5" fill="currentColor">
                {isModular ? 'Host: Cisco X210c M7 blade' : `Host: ${platform.hostCpu.split(' ').slice(0, 3).join(' ')}`}
              </text>
              <text x="123" y="38" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">{platform.systemRam}</text>

              <line x1="123" y1="48" x2="123" y2="66" stroke="currentColor" opacity="0.6" markerEnd="url(#topo-arrow-2)" />

              <rect x="8" y="66" width={VIEW_W - 16} height="40" rx="6" fill="none" stroke="currentColor" />
              <text x={VIEW_W / 2} y="86" textAnchor="middle" fontSize="11.5" fill="currentColor">{interconnectLabel}</text>
              <text x={VIEW_W / 2} y="100" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.55">
                {isModular ? 'Direct PCIe Gen5 bus to host blade and VIC adapters' : 'Every GPU reaches every other GPU without leaving the chassis'}
              </text>

              {chassisGpuXs.map((x, i) => {
                const active = i < totalGpus;
                return (
                  <g key={i} opacity={active ? 1 : 0.35}>
                    <rect x={x} y="122" width={chassisGpuW} height="40" rx="5" fill="none" stroke="currentColor" strokeDasharray={active ? undefined : '3,3'} />
                    <text x={x + chassisGpuW / 2} y="138" textAnchor="middle" fontSize="10" fill="currentColor">GPU {i}</text>
                    <text x={x + chassisGpuW / 2} y="152" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6" fontFamily="IBM Plex Mono, ui-monospace, monospace">
                      {active ? `${gpu.vramGb}GB` : 'idle'}
                    </text>
                    <line x1={x + chassisGpuW / 2} y1="106" x2={x + chassisGpuW / 2} y2="122" stroke="currentColor" opacity={active ? 0.5 : 0.2} />
                  </g>
                );
              })}

              <text x={VIEW_W / 2} y="188" textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.75">
                ↓ {gpusPerUnit}× {platform.vendor === 'cisco' && isModular ? '100G VIC' : `${platform.nicSpeedGbps || 400}G OSFP`} NICs, one per GPU (rail-optimized, GPUDirect RDMA)
              </text>
            </svg>
            <figcaption className="text-[11.5px] text-zinc-400 leading-relaxed mt-2">
              One NIC per GPU keeps each rail electrically isolated end-to-end, from the GPU's own {gpu.interconnectType === 'nvlink' ? 'NVLink' : 'PCIe'} domain out to its dedicated leaf switch port.
            </figcaption>
          </figure>

          <div className="flex flex-col">
            {[
              ['Host', `${platform.hostCpu} · ${platform.systemRam}`],
              ['Interconnect', interconnectLabel],
              ['Accelerators', `${gpusPerUnit}× ${gpu.name}`],
              ['Network I/O', `${gpusPerUnit}× ${platform.nicSpeedGbps || 400}G (1 per GPU)`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-1.5 border-b border-zinc-800/60 last:border-b-0 text-[12px]">
                <span className="text-zinc-500">{k}</span>
                <span className="text-zinc-200 text-right">{v}</span>
              </div>
            ))}
          </div>

          {!isMultiNode && (
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg flex items-start gap-2 text-[12px] text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-100">Single-unit alignment:</strong> this workload fits inside a single {isModular ? 'blade pair' : `${platform.name} chassis`}, so every tensor operation stays local — zero cross-chassis network hops for token generation.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Network Configuration Checklist Footer */}
      <div className="pt-3 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-200 font-semibold text-[12.5px] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Lossless network configuration checklist
          </span>
          <span className="text-[10.5px] text-zinc-400 font-mono">
            {protocol.id === 'rocev2' ? 'RoCEv2 (Ethernet)' : 'Native InfiniBand (NDR)'}
          </span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1">
          {protocol.keyRequirements.map((req, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[11.5px] text-zinc-400 py-0.5">
              <span className="text-emerald-400 shrink-0">✓</span>
              <span>{req}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
