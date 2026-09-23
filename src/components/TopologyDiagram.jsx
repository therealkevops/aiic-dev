import React, { useState } from 'react';
import { 
  Server, 
  Cpu, 
  Network, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Info, 
  ArrowDown, 
  Activity,
  HardDrive,
  CheckCircle2,
  Box,
  Split
} from 'lucide-react';

const ALL_RAIL_COLORS = [
  { id: 0, name: 'Rail 0', hex: '#38bdf8', text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/40', badge: 'bg-zinc-800 text-sky-300 border-sky-600' },
  { id: 1, name: 'Rail 1', hex: '#7dd3fc', text: 'text-sky-300', bg: 'bg-sky-400/10', border: 'border-sky-400/40', badge: 'bg-zinc-800 text-sky-200 border-sky-500' },
  { id: 2, name: 'Rail 2', hex: '#0ea5e9', text: 'text-sky-500', bg: 'bg-sky-500/15', border: 'border-sky-500/50', badge: 'bg-zinc-800 text-sky-400 border-sky-600' },
  { id: 3, name: 'Rail 3', hex: '#0284c7', text: 'text-sky-600', bg: 'bg-sky-600/15', border: 'border-sky-600/50', badge: 'bg-zinc-800 text-sky-300 border-sky-700' },
  { id: 4, name: 'Rail 4', hex: '#e4e4e7', text: 'text-zinc-200', bg: 'bg-zinc-700/20', border: 'border-zinc-500/40', badge: 'bg-zinc-800 text-zinc-100 border-zinc-500' },
  { id: 5, name: 'Rail 5', hex: '#d4d4d8', text: 'text-zinc-300', bg: 'bg-zinc-700/20', border: 'border-zinc-600/40', badge: 'bg-zinc-800 text-zinc-200 border-zinc-600' },
  { id: 6, name: 'Rail 6', hex: '#a1a1aa', text: 'text-zinc-400', bg: 'bg-zinc-800/30', border: 'border-zinc-600/40', badge: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  { id: 7, name: 'Rail 7', hex: '#71717a', text: 'text-zinc-500', bg: 'bg-zinc-800/40', border: 'border-zinc-700/50', badge: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
];

export function TopologyDiagram({ results, gpu, platform, protocol }) {
  const { nodes, totalGpus, network, bom } = results;
  const isModular = platform && platform.isModular;
  const isMultiNode = nodes > 1;

  // The actual number of GPUs in one compute unit (chassis or blade pair)
  const gpusPerUnit = platform ? platform.gpusPerChassis : (gpu.gpusPerChassis || 8);
  const activeRailColors = ALL_RAIL_COLORS.slice(0, gpusPerUnit);

  // View state: 'logical' (network tiers) or 'chassis' (inside the server/blade)
  const [viewMode, setViewMode] = useState(isMultiNode ? 'logical' : 'chassis');
  const [activeRail, setActiveRail] = useState(null);

  // Number of units to render visually (max 4 to keep layout clean)
  const displayedUnits = Math.min(nodes, 4);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-sans space-y-4">
      
      {/* Header with View Toggle & Protocol Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-sm text-zinc-100">
            {isModular ? 'Cisco UCS X-Series Modular Architecture' : 'Cluster Topology & Hardware Schematic'}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
            {bom.chassisCount} Chassis • {totalGpus} GPUs
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-xs">
            {isMultiNode && (
              <button
                type="button"
                onClick={() => setViewMode('logical')}
                className={`px-2.5 py-1 rounded transition text-xs font-medium ${
                  viewMode === 'logical' 
                    ? 'bg-sky-600 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Network Rails
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode('chassis')}
              className={`px-2.5 py-1 rounded transition text-xs font-medium ${
                viewMode === 'chassis' 
                  ? 'bg-sky-600 text-white shadow-sm' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isModular ? 'Blade & Chassis View' : 'Chassis & Bus View'}
            </button>
          </div>

          <span className="px-2 py-1 rounded bg-zinc-800 text-sky-400 border border-zinc-700 text-[11px] font-medium hidden md:inline-block">
            {protocol.name}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MULTI-NODE LOGICAL NETWORK VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'logical' && isMultiNode && (
        <div className="space-y-4">
          
          {/* Interactive Rail Trace Bar */}
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span>Interactive Rail Inspector ({activeRailColors.length} GPU Rails):</span>
              </span>
              <span className="text-zinc-500 text-[10px]">
                Click a rail to trace its dedicated GPU-to-switch path across all nodes
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setActiveRail(null)}
                className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
                  activeRail === null
                    ? 'bg-zinc-700 text-white border-zinc-500'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                Show All Rails
              </button>
              {activeRailColors.map((rail) => (
                <button
                  key={`btn-rail-${rail.id}`}
                  onClick={() => setActiveRail(activeRail === rail.id ? null : rail.id)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border transition flex items-center gap-1 ${
                    activeRail === rail.id
                      ? `${rail.badge} ring-1 ring-white/20 font-bold scale-105`
                      : activeRail !== null
                      ? 'bg-zinc-900/40 text-zinc-600 border-zinc-800/40'
                      : `${rail.bg} ${rail.text} ${rail.border}`
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rail.hex }}></span>
                  <span>{rail.name}</span>
                </button>
              ))}
            </div>

            {/* Plain English explanation of active selection */}
            <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2 rounded border border-zinc-800/60 leading-relaxed">
              {activeRail === null ? (
                <span>
                  💡 <strong>Rail-Optimized Architecture:</strong> Each {platform.name} has {gpusPerUnit} GPUs per compute unit. Each GPU connects to an independent Leaf rail switch (Rails 0 to {gpusPerUnit - 1}) to prevent traffic congestion.
                </span>
              ) : (
                <span>
                  🔍 <strong>Tracing {activeRailColors[activeRail].name}:</strong> GPU #{activeRail} on <em>every compute unit</em> routes exclusively to <strong>Leaf Switch #{activeRail + 1}</strong>. When nodes exchange pipeline activations or all-gather tensors, packets stay on this isolated physical rail.
                </span>
              )}
            </div>
          </div>

          {/* Tier 1: Spine Fabric (Core) */}
          {bom.spineSwitchCount > 0 ? (
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-200">
                <span className="font-bold flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-sky-400" />
                  Tier 1: Spine Fabric Layer ({bom.spineSwitchCount}x {bom.spineSwitchModel})
                </span>
                <span className="text-[10px] text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                  1:1 Non-Blocking Clos
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Array.from({ length: Math.min(bom.spineSwitchCount, 4) }).map((_, i) => (
                  <div
                    key={`spine-${i}`}
                    className="bg-zinc-900 border border-zinc-700/60 p-2 rounded-lg text-center shadow-sm"
                  >
                    <div className="text-xs font-bold text-zinc-100">
                      {bom.spineSwitchModel.split('(')[0].trim()} #{i + 1}
                    </div>
                    <div className="text-[10px] text-sky-400 font-mono mt-0.5">Non-Blocking Core</div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-zinc-400 pt-1">
                • Connects all leaf switches, delivering {network.totalClusterBisectionTbps.toFixed(1)} Tbps aggregate bisection bandwidth across the entire cluster.
              </p>
            </div>
          ) : (
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] text-zinc-400 text-center">
              Single-Tier Topology: External Spine fabric is not required for this node count.
            </div>
          )}

          {/* Spine-to-Leaf Trunk Lines */}
          {bom.spineSwitchCount > 0 && (
            <div className="flex justify-center -my-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                <ArrowDown className="w-3 h-3 text-sky-400 animate-pulse" />
                <span>Lossless Inter-Switch Uplinks</span>
                <ArrowDown className="w-3 h-3 text-sky-400 animate-pulse" />
              </div>
            </div>
          )}

          {/* Tier 2: Leaf Switch Rails */}
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                Tier 2: Leaf Switch Tier ({bom.leafSwitchCount}x {bom.leafSwitchModel})
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {activeRailColors.length} Rail Slices
              </span>
            </div>

            <div className={`grid grid-cols-${Math.min(activeRailColors.length, 8)} gap-1.5`}>
              {activeRailColors.map((rail) => {
                const isSelected = activeRail === rail.id;
                const isDimmed = activeRail !== null && !isSelected;

                return (
                  <div
                    key={`leaf-${rail.id}`}
                    onClick={() => setActiveRail(isSelected ? null : rail.id)}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected 
                        ? `${rail.badge} ring-2 ring-white/30 scale-105 shadow-md` 
                        : isDimmed 
                        ? 'opacity-25 bg-zinc-900 border-zinc-800' 
                        : `${rail.bg} ${rail.border}`
                    }`}
                  >
                    <div className="text-[10px] text-zinc-400">Leaf #{rail.id + 1}</div>
                    <div className={`font-bold text-xs ${rail.text}`}>{rail.name}</div>
                    <div className="text-[9px] text-zinc-500 font-mono mt-0.5">GPU {rail.id} Link</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Tier 2.5: Cisco UCS Fabric Interconnect Tier (for Modular X-Series) */}
          {isModular && bom.fabricInterconnectModel && (
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-200">
                <span className="font-bold flex items-center gap-1.5">
                  <Split className="w-3.5 h-3.5 text-sky-400" />
                  Unified I/O Tier: {bom.fabricInterconnectModel}
                </span>
                <span className="text-[10px] text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                  Cisco Intersight Managed
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">
                • Dual 6536 Fabric Interconnects aggregate traffic from the X9508 chassis IFMs and provide deterministic 100G/400G uplinks to the Nexus leaf switches.
              </p>
            </div>
          )}

          {/* Leaf-to-GPU Downlinks */}
          <div className="flex justify-center -my-2">
            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
              <ArrowDown className="w-3 h-3 text-sky-400 animate-pulse" />
              <span>Dedicated Rail Cabling to GPU Host Adapters</span>
              <ArrowDown className="w-3 h-3 text-sky-400 animate-pulse" />
            </div>
          </div>

          {/* Tier 3: Compute Units (Server Nodes or Blade Pairs) */}
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                Tier 3: Compute Tier ({bom.isModular ? `${bom.chassisCount}x X9508 Chassis (${nodes} Blade Pairs)` : `${nodes} Server Node${nodes > 1 ? 's' : ''}`})
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {platform.shortName} • {totalGpus} Active GPU{totalGpus > 1 ? 's' : ''} / {nodes * gpusPerUnit} Sockets
              </span>
            </div>

            {/* Note if some physical sockets are unallocated */}
            {totalGpus < nodes * gpusPerUnit && (
              <div className="p-2 bg-amber-950/20 border border-amber-800/40 rounded-lg text-[11px] text-amber-200/90 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Workload vs Physical Hardware:</strong> This workload requires <strong>{totalGpus} GPUs</strong> (highlighted in color). 
                  The physical {platform.shortName} chassis provides <strong>{nodes * gpusPerUnit} GPU sockets</strong>, leaving <strong>{(nodes * gpusPerUnit) - totalGpus} sockets unallocated</strong> (grayed out below) and free for other jobs.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: displayedUnits }).map((_, unitIdx) => (
                <div
                  key={`unit-card-${unitIdx}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                    <span className="font-bold text-zinc-200 text-xs flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-sky-400" />
                      {isModular ? `Blade Pair #${unitIdx + 1} [X210c + X440p]` : `${platform.shortName} #${unitIdx + 1}`}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                      {Math.min(gpusPerUnit, Math.max(0, totalGpus - (unitIdx * gpusPerUnit)))} Active / {gpusPerUnit} Physical
                    </span>
                  </div>

                  {/* GPUs inside this compute unit */}
                  <div className={`grid grid-cols-${Math.min(gpusPerUnit, 4)} gap-1.5`}>
                    {Array.from({ length: gpusPerUnit }).map((_, gpuIdx) => {
                      const globalGpuIdx = (unitIdx * gpusPerUnit) + gpuIdx;
                      const isGpuActive = globalGpuIdx < totalGpus;
                      const rail = activeRailColors[gpuIdx] || ALL_RAIL_COLORS[gpuIdx % 8];
                      const isSelected = activeRail === gpuIdx;
                      const isDimmed = !isGpuActive || (activeRail !== null && !isSelected);

                      if (!isGpuActive) {
                        return (
                          <div
                            key={`u${unitIdx}-g${gpuIdx}`}
                            className="p-1.5 rounded border border-dashed border-zinc-800 bg-zinc-950/40 text-center opacity-40 select-none"
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-500">
                              <Cpu className="w-3 h-3 text-zinc-600" />
                              <span>GPU {gpuIdx}</span>
                            </div>
                            <div className="text-[9px] text-zinc-600 font-mono mt-0.5">
                              Unallocated
                            </div>
                            <div className="mt-1 pt-0.5 border-t border-zinc-900 text-[8px] text-zinc-600 tracking-tight">
                              Socket Idle
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`u${unitIdx}-g${gpuIdx}`}
                          onClick={() => setActiveRail(isSelected ? null : gpuIdx)}
                          className={`p-1.5 rounded border text-center transition-all cursor-pointer ${
                            isSelected
                              ? `${rail.badge} ring-2 ring-white/40 scale-105 shadow-md`
                              : isDimmed
                              ? 'opacity-25 bg-zinc-950 border-zinc-800'
                              : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-200">
                            <Cpu className="w-3 h-3 text-sky-400" />
                            <span>GPU {gpuIdx}</span>
                          </div>

                          <div className="text-[9px] text-zinc-400 font-mono">
                            {gpu.vramGb} GB
                          </div>

                          {/* Matching Rail Tag */}
                          <div
                            className={`mt-1 pt-0.5 border-t border-zinc-800/80 text-[8px] font-bold tracking-tight ${rail.text}`}
                          >
                            NIC → {rail.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Internal Bus Banner */}
                  <div className="p-1.5 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-between text-[9px] text-zinc-300 font-mono">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>{isModular ? 'Cisco X-Fabric PCIe' : gpu.interconnect}</span>
                    </div>
                    <span className="text-amber-400 font-sans font-medium">
                      {gpu.interconnectType === 'nvlink' ? 'NVLink All-Reduce Zone' : 'PCIe Host Bus'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {nodes > 4 && (
              <div className="p-2 text-center text-zinc-400 text-xs bg-zinc-900/60 rounded border border-dashed border-zinc-800">
                + {nodes - 4} additional identical compute units connected to the same {bom.leafSwitchCount} leaf switches
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CHASSIS & INTERNAL INTERCONNECT ARCHITECTURE */}
      {/* ========================================================================= */}
      {viewMode === 'chassis' && (
        <div className="space-y-4">
          
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs leading-relaxed text-zinc-300">
            <div className="font-semibold text-zinc-100 mb-1 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>
                {isModular ? 'Inside Cisco UCS X-Series: Modular X-Fabric Architecture' : `Inside ${platform.name}: Interconnect & Bus Topology`}
              </span>
            </div>
            <p className="text-zinc-400">
              {isModular ? (
                <span>
                  The <strong>Cisco UCS X9508 7U chassis</strong> pairs the <strong>X210c M7 compute blade</strong> with the <strong>X440p PCIe accelerator node</strong> via <strong>Cisco X-Fabric</strong>. 
                  This delivers direct PCIe Gen5 bandwidth between the host CPUs and the {gpusPerUnit}x {gpu.name} cards, connected to dual UCS 6536 Fabric Interconnects.
                </span>
              ) : gpu.interconnectType === 'nvlink' ? (
                <span>
                  All {gpusPerUnit} GPUs inside the {platform.shortName} chassis are linked via a dedicated <strong>NVSwitch Fabric</strong> providing <strong>{gpu.interconnect}</strong> bi-directional bandwidth directly between GPU memory spaces.
                </span>
              ) : (
                <span>
                  The {gpusPerUnit} GPUs inside {platform.shortName} communicate with the host CPUs via dedicated PCIe Gen4/Gen5 root complexes.
                </span>
              )}
            </p>
          </div>

          {/* Physical Schematic */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4">
            
            {/* Top: Host Compute Subsystem */}
            <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="font-bold text-xs text-zinc-200">
                    {isModular ? 'Cisco UCS X210c M7 Compute Blade' : `${platform.shortName} Host Subsystem`}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {platform.hostCpu} • {platform.systemRam}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {isModular ? 'Modular Compute Blade' : 'Host Subsystem'}
                </span>
              </div>
            </div>

            {/* Middle: Accelerator & Interconnect Core */}
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl relative">
              <div className="text-center mb-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                  {isModular ? 'Cisco UCS X440p PCIe Accelerator Node (X-Fabric Midplane)' : 'GPU Accelerator Baseboard'}
                </span>
              </div>

              {/* Interconnect Center Box */}
              <div className="my-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-center space-y-1 shadow-inner">
                <div className="flex items-center justify-center gap-1.5 font-bold text-zinc-200 text-xs">
                  <Zap className="w-4 h-4 text-sky-400" />
                  {isModular ? 'Cisco X-Fabric PCIe Gen5 Midplane' : gpu.interconnectType === 'nvlink' ? 'NVSwitch High-Speed Interconnect Fabric' : 'PCIe Dual-Root Interconnect Bus'}
                </div>
                <div className="text-[11px] text-sky-400 font-mono">
                  {gpu.interconnect}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {gpu.interconnectType === 'nvlink' 
                    ? '⚡ All GPUs communicate at RAM speeds with sub-microsecond All-Reduce latency' 
                    : 'Direct PCIe Gen5 bus to host compute blade and VIC adapters'}
                </div>
              </div>

              {/* Display EXACTLY gpusPerUnit GPUs */}
              <div className={`grid grid-cols-${Math.min(gpusPerUnit, 4)} gap-2 mt-3`}>
                {Array.from({ length: gpusPerUnit }).map((_, gpuIdx) => {
                  const isGpuActive = gpuIdx < totalGpus;

                  if (!isGpuActive) {
                    return (
                      <div
                        key={`chassis-gpu-${gpuIdx}`}
                        className="p-2.5 rounded-lg bg-zinc-950/40 border border-dashed border-zinc-800 text-center opacity-40 select-none"
                      >
                        <div className="flex items-center justify-center gap-1 font-bold text-zinc-500 text-xs">
                          <Cpu className="w-3.5 h-3.5 text-zinc-600" />
                          <span>GPU {gpuIdx}</span>
                        </div>
                        <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">
                          {gpu.vramGb} GB (Unallocated)
                        </div>
                        <div className="text-[9px] text-zinc-600 font-mono mt-1 pt-1 border-t border-zinc-900">
                          Socket Idle / Free
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`chassis-gpu-${gpuIdx}`}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-center hover:border-sky-500/80 transition"
                    >
                      <div className="flex items-center justify-center gap-1 font-bold text-zinc-100 text-xs">
                        <Cpu className="w-3.5 h-3.5 text-sky-400" />
                        <span>GPU {gpuIdx}</span>
                      </div>
                      <div className="text-[10px] text-zinc-300 font-semibold mt-0.5">
                        {gpu.vramGb} GB {gpu.name.includes('L40S') ? 'GDDR6' : 'HBM'}
                      </div>
                      <div className="text-[9px] text-emerald-400 font-mono mt-1 pt-1 border-t border-zinc-800">
                        {gpu.interconnectType === 'nvlink' ? 'Active NVLink Port' : 'Active PCIe Port'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom: Network I/O Adapters */}
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-sky-400" />
                  Network I/O Subsystem
                </span>
                <span className="text-[10px] text-zinc-400">
                  {platform.hostNics}
                </span>
              </div>

              <div className={`grid grid-cols-${Math.min(gpusPerUnit, 8)} gap-1.5`}>
                {Array.from({ length: gpusPerUnit }).map((_, nicIdx) => (
                  <div
                    key={`nic-${nicIdx}`}
                    className="p-1.5 bg-zinc-950 border border-zinc-800 rounded text-center text-zinc-300"
                  >
                    <div className="text-[9px] text-zinc-500">Port {nicIdx}</div>
                    <div className="font-bold text-[10px] text-zinc-200">NIC #{nicIdx}</div>
                    <div className="text-[8px] text-zinc-500 font-mono">
                      {platform.vendor === 'cisco' && isModular ? '100G VIC' : '400G OSFP'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {!isMultiNode && (
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-start gap-2 text-xs text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-100">Single Unit Alignment:</strong> This workload fits into a single {isModular ? 'Cisco UCS X-Series blade pair' : `${platform.name} chassis`}. 
                All tensor operations execute locally, completely eliminating cross-chassis network hops for token generation.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Network Configuration Checklist Footer */}
      <div className="pt-3 border-t border-zinc-800 font-sans">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-200 font-semibold text-xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Lossless Network Configuration Checklist:</span>
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">
            {protocol.id === 'rocev2' ? 'Lossless RoCEv2 (Ethernet)' : 'Native InfiniBand (NDR)'}
          </span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px] text-zinc-300">
          {protocol.keyRequirements.map((req, idx) => (
            <li key={idx} className="flex items-start gap-1.5 bg-zinc-950/80 p-1.5 rounded border border-zinc-800/80">
              <span className="text-emerald-400 font-bold">•</span>
              <span className="text-zinc-300">{req}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
