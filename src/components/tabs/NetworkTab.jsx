import React from 'react';
import { Network } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, Field, Row, Rows, ScaleField, SectionLabel } from '../ui';

export function NetworkTab({ ctx }) {
  const {
    availableProtocols, network, oversubscriptionRatio, selectedProtocolId, selectedVendor, setOversubscriptionRatio,
    setSelectedProtocolId,
  } = ctx;
  return (
    <>
      <Card icon={Network} title="4. Network Fabric" className="space-y-4">
        <Field label="Scale-Out Network Architecture" helper={
          <>
            {selectedVendor !== 'nvidia' && (
              <div className="text-[11px] text-zinc-400 mt-1.5">
                {selectedVendor === 'cisco' ? 'Cisco Nexus AI Fabric' : 'AMD Instinct platforms'} use Lossless RoCEv2 (PFC 802.1Qbb + ECN). NVIDIA InfiniBand is available on NVIDIA DGX platforms.
              </div>
            )}
            <InfoHelper
              title="Why AI Requires Lossless Networks"
              text="In distributed AI, GPUs pause at synchronization barriers (All-Reduce / All-to-All) waiting for the slowest GPU to report. Standard TCP packet drops cause multi-millisecond retransmit timeouts, causing every GPU in the cluster to stall at 0% utilization."
              whyItMatters="RoCEv2 solves this using hardware PFC (Priority Flow Control) and ECN on Ethernet switches. InfiniBand solves it via hardware credit-based flow control."
            />
          </>
        }>
          <select
            value={selectedProtocolId}
            onChange={(e) => setSelectedProtocolId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            {availableProtocols.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.speedGbps} Gbps / port)</option>
            ))}
          </select>
        </Field>

        {/* Leaf-Spine Oversubscription Ratio */}
        <div className="pt-3 border-t border-zinc-800/70">
          <ScaleField
            label="Leaf-Spine Oversubscription Ratio:"
            value={oversubscriptionRatio}
            onChange={setOversubscriptionRatio}
            presets={[1, 2, 3, 4]}
            min={1}
            max={8}
            suffix=":1"
            helper={
              <InfoHelper
                title="Leaf-Spine Oversubscription Ratio"
                text="The ratio of leaf switch downlink (GPU-facing) bandwidth to uplink (spine-facing) bandwidth. 1:1 is 'non-blocking' -- every leaf can talk to every other leaf at full downlink rate simultaneously. Higher ratios (2:1, 4:1) halve or quarter the spine switch count by accepting less cross-leaf bandwidth."
                whyItMatters="Only applies once a cluster spans more than one leaf switch (roughly 64+ GPUs on this fabric) -- below that, all GPUs sit behind a single non-blocking leaf and this setting has no effect. Above it, this is a real cost/bandwidth trade-off: an all-to-all-heavy workload (large TP/PP training) wants 1:1, while a mostly-independent-replica inference fleet can often tolerate 2:1 or higher."
              />
            }
          />
        </div>

        {/* Live fabric topology readout -- reacts to both the protocol and the oversubscription ratio above */}
        <div className="pt-3 border-t border-zinc-800/70">
          <SectionLabel>RESULTING FABRIC TOPOLOGY</SectionLabel>
          <Rows>
            <Row k="Topology" v={network.topology} mono={false} />
            <Row k="Leaf / spine switches" v={`${network.leafSwitches} / ${network.spineSwitches}`} mono={false} />
            <Row k="Raw NIC-aggregate bandwidth" v={`${network.totalClusterBisectionTbps.toFixed(1)} Tbps`} mono={false} />
            <Row
              k="Effective bisection bandwidth"
              v={`${network.effectiveBisectionTbps.toFixed(1)} Tbps${network.effectiveOversubscriptionRatio > 1 ? ` (${network.effectiveOversubscriptionRatio.toFixed(0)}:1 derated)` : ''}`}
              tone={network.effectiveOversubscriptionRatio > 1 ? 'warn' : 'good'}
            />
          </Rows>
        </div>
      </Card>
    </>
  );
}
