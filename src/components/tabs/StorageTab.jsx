import React from 'react';
import { Database } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, ChoiceCard, Field, Row, Rows, ScaleField, SliderField, Tag, ToggleRow } from '../ui';
import { DURABILITY_SCHEMES, STORAGE_TIERS } from '../../data/storage';

export function StorageTab({ ctx }) {
  const {
    checkpointRetentionCount, checkpointTargetWriteTimeSec, corpusSizeGb, datasetSizeTb, enableKvOffload, modelRepoTargetLoadTimeSec,
    modelRepoVersionCount, selectedDurabilitySchemeId, selectedStorageTierId, setCheckpointRetentionCount, setCheckpointTargetWriteTimeSec, setCorpusSizeGb,
    setDatasetSizeTb, setEnableKvOffload, setModelRepoTargetLoadTimeSec, setModelRepoVersionCount, setSelectedDurabilitySchemeId, setSelectedStorageTierId,
    storage, workloadType, kvActiveSessionPct, setKvActiveSessionPct, workloadShape,
  } = ctx;
  return (
    <>
      <Card
        icon={Database}
        title="6. Storage Capacity & Throughput"
        right={<Tag tone={storage.fits ? 'good' : 'warn'}>{storage.fits ? 'Sized to fit' : 'Undersized'}</Tag>}
        className="space-y-4"
      >
        <Field label="Storage Tier" helper={
          <InfoHelper
            title="Storage Tier"
            text="Reference storage platforms spanning the range enterprises and neo-clouds actually deploy, from throughput-dense NVMe parallel filesystems to cheap bulk object storage. Each tier is sized in rack-unit (RU) increments — capacity and throughput per RU vary widely between tiers."
            whyItMatters="The tier determines how many RU are needed to satisfy both the capacity and throughput requirement below — whichever is more binding. A cheap, low-throughput tier can need far more RU (and rack space) than a throughput-dense one to hit the same target."
          />
        }>
          <div className="grid grid-cols-1 gap-1.5">
            {STORAGE_TIERS.map((t) => (
              <ChoiceCard
                key={t.id}
                selected={selectedStorageTierId === t.id}
                onClick={() => setSelectedStorageTierId(t.id)}
                title={`${t.vendor} — ${t.name}`}
                desc={`${t.capacityPerRuTb} TB/RU · ${t.throughputPerRuGBs} GB/s/RU · ${t.recommendedFor}`}
              />
            ))}
          </div>
        </Field>

        <Field label="Durability Scheme" helper={
          <InfoHelper
            title="Durability Scheme"
            text="How much raw capacity is consumed protecting data against drive/node failure. A replication factor of 2x means 2 raw TB are purchased for every 1 TB of usable data; erasure coding trades some of that overhead for better efficiency at the same or better failure tolerance."
            whyItMatters="This directly multiplies the raw capacity (and RU, and capex) that must be provisioned — skipping it entirely (no redundancy) is unrealistic for anything that isn't disposable/cache data."
          />
        }>
          <div className="grid grid-cols-1 gap-1.5">
            {DURABILITY_SCHEMES.map((d) => (
              <ChoiceCard
                key={d.id}
                selected={selectedDurabilitySchemeId === d.id}
                onClick={() => setSelectedDurabilitySchemeId(d.id)}
                title={`${d.label} (${d.replicationFactor.toFixed(2)}x raw)`}
                desc={d.description}
              />
            ))}
          </div>
        </Field>

        {workloadType === 'training' ? (
          <>
            <SliderField
              label="Checkpoint Retention Count:"
              valueLabel={`${checkpointRetentionCount} checkpoints`}
              min="1" max="10" step="1"
              value={checkpointRetentionCount}
              onChange={(e) => setCheckpointRetentionCount(Number(e.target.value))}
              marks={['1 (Latest only)', '3 (Typical)', '10 (Long rollback)']}
            />
            <SliderField
              label="Checkpoint Write Time Budget:"
              valueLabel={`${checkpointTargetWriteTimeSec}s`}
              min="10" max="300" step="10"
              value={checkpointTargetWriteTimeSec}
              onChange={(e) => setCheckpointTargetWriteTimeSec(Number(e.target.value))}
              marks={['10s (Aggressive)', '60s (Typical)', '300s (Relaxed)']}
              helper={
                <InfoHelper
                  title="Checkpoint Write Time Budget"
                  text="The wall-clock time budget for writing a full checkpoint (master weights + optimizer states) to storage. This sets the required sustained write throughput: throughput = checkpoint size ÷ this budget."
                  whyItMatters="At massive scale, a checkpoint that takes too long to write stalls every GPU in the cluster for its duration — a real, recurring cost during long pretraining runs. A tighter budget requires a faster (and more expensive) storage tier."
                />
              }
            />
            <ScaleField
              label="Training Dataset Size:"
              value={datasetSizeTb}
              onChange={setDatasetSizeTb}
              presets={[10, 50, 200, 1000]}
              min={1} max={10000}
              suffix=" TB"
              helper={
                <InfoHelper
                  title="Training Dataset Size"
                  text="The active, tokenized dataset footprint that must stay resident on fast storage for streaming into the training pipeline. Sized against a sustained ~200 MB/s-per-accelerator streaming target — a commonly cited floor for keeping modern accelerator pipelines fed without I/O stalls."
                  whyItMatters="Undersized dataset throughput shows up as GPU idle time waiting on data loaders, silently eating into effective MFU the same way a slow checkpoint write does."
                />
              }
            />
          </>
        ) : (
          <>
            <SliderField
              label="Cached Model Versions:"
              valueLabel={`${modelRepoVersionCount} versions`}
              min="1" max="5" step="1"
              value={modelRepoVersionCount}
              onChange={(e) => setModelRepoVersionCount(Number(e.target.value))}
              marks={['1 (Single version)', '2 (Blue/green)', '5 (Multi-version repo)']}
            />
            <SliderField
              label="Model Load Time Budget:"
              valueLabel={`${modelRepoTargetLoadTimeSec}s`}
              min="15" max="300" step="15"
              value={modelRepoTargetLoadTimeSec}
              onChange={(e) => setModelRepoTargetLoadTimeSec(Number(e.target.value))}
              marks={['15s (Fast autoscale)', '120s (Typical)', '300s (Relaxed)']}
              helper={
                <InfoHelper
                  title="Model Load Time Budget"
                  text="The wall-clock target for pulling model weights from the storage repository onto a newly booted or autoscaled serving node. Sets required read throughput: throughput = model size ÷ this budget."
                  whyItMatters="A tight budget matters for autoscaling and node-failure recovery — a slow model repo directly adds to time-to-first-token-served on a new replica."
                />
              }
            />
            <ToggleRow
              label="KV Cache Disk / CXL Offload"
              description={enableKvOffload ? 'Paging beyond VRAM to disk/CXL tiering.' : 'KV cache stays VRAM-only.'}
              checked={enableKvOffload}
              onChange={setEnableKvOffload}
            />
            {enableKvOffload && (
              <SliderField
                label="Sessions actively generating at once:"
                valueLabel={`${kvActiveSessionPct}% (${workloadShape.gpuResidentSessions.toLocaleString()} of ${workloadShape.totalSessions.toLocaleString()})`}
                min="10" max="100" step="5"
                value={kvActiveSessionPct}
                onChange={(e) => setKvActiveSessionPct(Number(e.target.value))}
                marks={['10% (mostly idle agents / readers)', '100% (all active)']}
                helper={
                  <InfoHelper
                    title="Active vs. Offloaded Sessions"
                    text="Open sessions that are waiting (an agent running a tool, a user reading the last answer) don't need their KV cache on the GPU. With offload, their KV moves to CPU memory or NVMe and returns when they resume, so GPUs are sized only for the sessions generating right now."
                    whyItMatters="For agent and chat workloads where many sessions sit idle, this can cut GPU count substantially. The offload tier must then hold every session's KV and page it back fast enough; its size and throughput appear in the storage breakdown."
                  />
                }
              />
            )}
          </>
        )}

        <ScaleField
          label="Document / Vector Corpus (optional):"
          value={corpusSizeGb}
          onChange={setCorpusSizeGb}
          presets={[0, 100, 500, 5000]}
          min={0} max={100000}
          suffix=" GB"
          helper={
            <InfoHelper
              title="Document / Vector Corpus"
              text="Capacity for a RAG document store or vector index, sized independently of the compute-side KV cache. Capacity-only — not treated as throughput-binding against the storage tier."
              whyItMatters="RAG-shaped workloads (document analysis, deep research agents) can carry a corpus far larger than the model itself; this keeps that capacity visible in the BOM even though it doesn't drive throughput sizing."
            />
          }
        />

        <div className="pt-3 border-t border-zinc-800/70">
          <Rows>
            <Row k="Usable capacity needed" v={`${storage.requiredCapacityTb.toFixed(2)} TB`} tone="accent" />
            <Row k="Raw capacity to provision" v={`${storage.requiredRawCapacityTb.toFixed(2)} TB (${storage.replicationFactor.toFixed(2)}x)`} tone="accent" />
            <Row k="Required throughput" v={`${storage.requiredThroughputGBs.toFixed(2)} GB/s`} tone="accent" />
            <Row k="Binding constraint" v={storage.bindingConstraint === 'throughput' ? 'Throughput' : 'Capacity'} mono={false} />
            <Row k="Provisioned" v={`${storage.provisionedRu} RU of ${storage.storageTier.vendor}`} mono={false} />
            <Row k="Achieved (raw / usable)" v={`${storage.achievedCapacityTb.toFixed(0)} TB / ${storage.achievedUsableCapacityTb.toFixed(0)} TB`} mono={false} />
            <Row k="Achieved throughput" v={`${storage.achievedThroughputGBs.toFixed(1)} GB/s`} tone={storage.fits ? 'good' : 'warn'} />
          </Rows>
        </div>
      </Card>
    </>
  );
}
