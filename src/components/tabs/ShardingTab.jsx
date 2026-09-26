import React from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Banner, Card, Field, Row, Rows, ScaleField, SegmentedToggle, SliderField, Tag, ToggleRow } from '../ui';

export function ShardingTab({ ctx }) {
  const {
    autoRecommendation, canAutoDp, concurrency, dp, isAutoDp, isAutoSharding,
    manualPp, manualTp, pp, setIsAutoDp, setIsAutoSharding, setManualDp,
    setManualPp, setManualTp, tp, workloadType, servingArchitecture, memoryHeadroomPct, setMemoryHeadroomPct,
    latencyTargetsEnabled, setLatencyTargetsEnabled, targetTtftSec, setTargetTtftSec, targetTpotMs, setTargetTpotMs,
    latencySolve, memorySizing, model, expertParallelNodes, setExpertParallelNodes, throughput, platform,
  } = ctx;
  const epAvailable = model.isMoe && workloadType === 'inference' && servingArchitecture !== 'llmd';
  const fmtSec = (sec) => (sec < 1 ? `${Math.round(sec * 1000)} ms` : `${sec.toFixed(2)} s`);
  const latencyTargetsAvailable = workloadType === 'inference' && isAutoSharding && servingArchitecture !== 'llmd';
  return (
    <>
      <Card
        icon={Layers}
        title="3. Model Sharding & Parallelism"
        right={
          <SegmentedToggle
            value={isAutoSharding ? 'auto' : 'manual'}
            onChange={(v) => {
              if (v === 'auto') { setIsAutoSharding(true); }
              else { setIsAutoSharding(false); setManualTp(tp); setManualPp(pp); setManualDp(dp); }
            }}
            options={[{ value: 'auto', label: 'Auto-Solver' }, { value: 'manual', label: 'Manual Override' }]}
          />
        }
        className="space-y-4"
      >
        {isAutoSharding ? (
          <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Optimal Sharding Decision</span>
              </span>
              <Tag tone="accent">TP={tp} · PP={pp}</Tag>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {autoRecommendation.rationale}
            </p>

            <div className="text-[11.5px] pt-2 border-t border-zinc-800/70 flex items-center justify-between gap-3">
              {autoRecommendation.fitsInOneNode ? (
                <span className="text-emerald-400 flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate"><strong>Single Node:</strong> PP locked at 1.</span>
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1.5 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate"><strong>Multi-Node:</strong> TP={tp} on NVLink, PP={pp} across fabric.</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => { setIsAutoSharding(false); setManualTp(tp); setManualPp(pp); setManualDp(dp); }}
                className="text-sky-400 hover:text-sky-300 underline font-medium shrink-0"
              >
                Override
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-2.5 bg-amber-950/30 border border-amber-800/50 rounded-lg text-xs text-amber-200">
              <span>Manual Mode: Customize TP &amp; PP independently.</span>
              <button
                type="button"
                onClick={() => setIsAutoSharding(true)}
                className="text-amber-300 underline font-semibold hover:text-amber-100 flex items-center gap-1 shrink-0 ml-2"
              >
                <RefreshCw className="w-3 h-3" />
                Reset to Solver
              </button>
            </div>

            {/* TP Degree */}
            <div>
              <div className="flex justify-between items-baseline text-xs mb-1.5">
                <span className="font-medium text-zinc-300">Tensor Parallelism (TP Degree):</span>
                <span className="font-semibold text-sky-400 font-mono">TP = {manualTp}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 8].map((val) => (
                  <button
                    key={`tp-${val}`}
                    type="button"
                    onClick={() => setManualTp(val)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      manualTp === val ? 'bg-sky-600 border-sky-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    TP={val}
                  </button>
                ))}
              </div>
              <InfoHelper
                title="Tensor Parallelism (Intra-Node Splitting)"
                text="Slices individual weight matrices (layers) across multiple GPUs simultaneously. All GPUs must communicate on EVERY single token generation step via All-Reduce operations."
                whyItMatters="GOLDEN RULE: TP must stay inside a single 8-GPU chassis over NVLink! Never set TP > 8 across network cables, or latency will spike by 10x to 50x."
              />
            </div>

            {/* PP Degree */}
            <div>
              <div className="flex justify-between items-baseline text-xs mb-1.5">
                <span className="font-medium text-zinc-300">Pipeline Parallelism (PP Nodes):</span>
                <span className="font-semibold text-sky-400 font-mono">PP = {manualPp}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 4, 8].map((val) => (
                  <button
                    key={`pp-${val}`}
                    type="button"
                    onClick={() => setManualPp(val)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      manualPp === val ? 'bg-sky-600 border-sky-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    PP={val}
                  </button>
                ))}
              </div>
              {manualPp > 1 && manualTp < 8 && (
                <div className="mt-2 p-2.5 bg-amber-950/60 border border-amber-700/60 rounded-lg text-[11px] text-amber-300 leading-snug">
                  <strong>Guidance:</strong> You have PP={manualPp} while TP is only {manualTp}. Maximize intra-node TP to 8 first over NVLink before splitting across nodes with PP.
                </div>
              )}
              <InfoHelper
                title="Pipeline Parallelism (Multi-Node Chaining)"
                text="Assigns consecutive layers of the model to different server nodes (e.g. Node 1 runs layers 1-40, Node 2 runs layers 41-80). Nodes only communicate when passing activation data from the boundary layer."
                whyItMatters="Used when a model is simply too big to fit inside a single 8-GPU node even at TP=8 (e.g., LLaMA-405B at FP16 or massive training)."
              />
            </div>
          </div>
        )}

        {/* DP Replicas (Applies to both modes; scales the cluster to 100s-1000s of GPUs) */}
        <div className="pt-3 border-t border-zinc-800/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Data Parallelism / Replicas (DP):</span>
            {canAutoDp && (
              <SegmentedToggle
                value={isAutoDp ? 'auto' : 'manual'}
                onChange={(v) => { setIsAutoDp(v === 'auto'); if (v === 'manual') setManualDp(dp); }}
                options={[{ value: 'auto', label: 'Auto-scale' }, { value: 'manual', label: 'Manual' }]}
              />
            )}
          </div>

          {canAutoDp && isAutoDp ? (
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">Sized to serve <strong className="text-white">{concurrency.toLocaleString()}</strong> concurrent streams</span>
                <Tag tone="accent">DP = {dp.toLocaleString()}</Tag>
              </div>
              <div className="text-[11px] text-zinc-400">
                ~{Math.ceil(concurrency / dp).toLocaleString()} streams/replica · {(dp * tp * pp).toLocaleString()} GPUs across all replicas
              </div>
            </div>
          ) : (
            <ScaleField
              value={dp}
              onChange={setManualDp}
              presets={[1, 8, 32, 128, 512, 2048]}
              min={1}
              max={4096}
            />
          )}
          <InfoHelper
            title="Data Parallelism (Horizontal Scaling)"
            text="Creates complete independent copies of your model instance. Each replica serves its own share of concurrent users (or training batches) in parallel — this is the dimension that scales a deployment from a handful of GPUs to a 1,000-4,000+ GPU supercluster."
            whyItMatters="For inference, Auto-scale derives DP directly from concurrency so every replica only has to hold KV cache for its own share of users. For training, pick DP to match your target cluster size — total GPUs = TP × PP × DP."
          />
        </div>
      </Card>
      {epAvailable && (
        <Card icon={Layers} title="Expert Parallelism (MoE)" className="space-y-3">
          <ScaleField
            label={platform.nvlinkDomainGpus ? '8-GPU groups per replica (expert-parallel span)' : 'Chassis per replica (expert-parallel span)'}
            value={expertParallelNodes}
            onChange={setExpertParallelNodes}
            presets={[1, 2, 4, 8]}
            min={1}
            max={32}
            helper={
              <InfoHelper
                title="Wide Expert Parallelism"
                text={`At 1, each replica's ${model.routedExperts} routed experts are split by TP. Above 1, a replica spans that many ${platform.nvlinkDomainGpus ? '8-GPU groups' : 'chassis'}: attention and shared weights stay TP=${Math.min(platform.gpusPerChassis, 8)} inside each group, each group serves its own share of the streams, and the routed experts are spread across every GPU in the replica. Tokens are exchanged between groups (all-to-all) at every MoE layer${platform.nvlinkDomainGpus ? ' -- over NVLink while the replica stays inside the rack\'s 72-GPU domain' : ''}.`}
                whyItMatters="Spreading experts leaves far more memory per GPU for KV cache, so large MoE deployments (DeepSeek, Kimi K2, Qwen3-235B) often need many fewer GPUs, and models too big for one chassis no longer need pipeline stages. The cost is all-to-all traffic on the scale-out fabric, which adds per-token latency and needs a non-blocking network."
              />
            }
          />
          {expertParallelNodes > 1 && throughput && (
            <div className="text-[11px] text-zinc-400">
              All-to-all adds ~{(throughput.t_a2a * 1000).toFixed(1)} ms to each decode step (included in time per output token).
            </div>
          )}
        </Card>
      )}

      <Card icon={Gauge} title="Sizing Targets" className="space-y-4">
        <SliderField
          label="Memory headroom margin:"
          valueLabel={`${memoryHeadroomPct}%`}
          min="0" max="20" step="1"
          value={memoryHeadroomPct}
          onChange={(e) => setMemoryHeadroomPct(Number(e.target.value))}
          marks={['0% (fill to limit)', '10%', '20%']}
          helper={
            <InfoHelper
              title="Memory Headroom Margin"
              text="Share of each GPU's usable memory (after the 10% runtime reserve) that sizing leaves empty. The solver adds replicas or GPUs so weights plus KV cache stay below this line."
              whyItMatters="A design sized to the last gigabyte preempts requests the moment prompts run longer than planned or traffic spikes. 5-10% is a common operating margin."
            />
          }
        />
        {memorySizing && (
          <div className="text-[11px] text-zinc-400 leading-relaxed">
            TP={tp} uses fewer GPUs than the smallest TP that fits (TP={memorySizing.minimalTp} would need {memorySizing.minimalGpus} GPUs): each replica stores the weights once, so spreading it across more GPUs frees memory for KV cache.
          </div>
        )}

        {workloadType === 'inference' && (
          <div className="space-y-3 pt-3 border-t border-zinc-800/70">
            <ToggleRow
              label="Size for latency targets"
              description={latencyTargetsAvailable
                ? 'Search larger TP and more replicas for the cheapest layout that meets both targets.'
                : 'Available with the auto-solver and colocated serving.'}
              checked={latencyTargetsEnabled && latencyTargetsAvailable}
              onChange={setLatencyTargetsEnabled}
              disabled={!latencyTargetsAvailable}
            />
            {latencyTargetsEnabled && latencyTargetsAvailable && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Time to first token (s)">
                    <input
                      type="number" min="0.05" max="600" step="0.1"
                      value={targetTtftSec}
                      onChange={(e) => setTargetTtftSec(Math.max(0.05, Number(e.target.value) || 0.05))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </Field>
                  <Field label="Time per output token (ms)">
                    <input
                      type="number" min="1" max="1000" step="1"
                      value={targetTpotMs}
                      onChange={(e) => setTargetTpotMs(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </Field>
                </div>
                <div className="text-[10.5px] text-zinc-500">
                  TTFT is unloaded: prefill plus guardrail and ingress latency. Queueing on top of it is set by target utilization on the SLA tab.
                </div>
                {latencySolve && (
                  <>
                    <Rows>
                      <Row k="Memory-only sizing" v={`${latencySolve.memoryOnly.totalGpus} GPUs · TP=${latencySolve.memoryOnly.tp} DP=${latencySolve.memoryOnly.dp} · ${fmtSec(latencySolve.memoryOnly.ttftSec)} / ${latencySolve.memoryOnly.tpotMs.toFixed(1)} ms`} />
                      <Row k={latencySolve.met ? 'Latency-sized' : 'Closest layout'} tone={latencySolve.met ? 'good' : 'warn'} v={`${latencySolve.chosen.totalGpus} GPUs · TP=${latencySolve.chosen.tp} DP=${latencySolve.chosen.dp} · ${fmtSec(latencySolve.chosen.ttftSec)} / ${latencySolve.chosen.tpotMs.toFixed(1)} ms`} />
                    </Rows>
                    {!latencySolve.met && (
                      <Banner tone="warn" icon={AlertTriangle} title="Targets not reachable on this platform">
                        {latencySolve.fixedLatencySec >= latencySolve.targetTtftSec
                          ? `Guardrail and ingress checks alone add ${fmtSec(latencySolve.fixedLatencySec)} before the first token, above the ${fmtSec(latencySolve.targetTtftSec)} target. Use a smaller guard model, check only outputs, or relax the target.`
                          : 'Even TP at the full chassis cannot meet both targets. Shorten prompts, use a faster GPU or lower precision, or relax the targets. The closest layout is shown and used.'}
                      </Banner>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
