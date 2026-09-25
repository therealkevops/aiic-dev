import React from 'react';
import { AlertTriangle, CheckCircle2, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, ScaleField, SegmentedToggle, Tag } from '../ui';

export function ShardingTab({ ctx }) {
  const {
    autoRecommendation, canAutoDp, concurrency, dp, isAutoDp, isAutoSharding,
    manualPp, manualTp, pp, setIsAutoDp, setIsAutoSharding, setManualDp,
    setManualPp, setManualTp, tp,
  } = ctx;
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
    </>
  );
}
