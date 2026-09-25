import React from 'react';
import { Building2 } from 'lucide-react';
import { InfoHelper } from '../InfoHelper';
import { Card, Field, Kpi, KpiRow, Row, Rows, SegmentedToggle } from '../ui';
import { PLATFORM_VENDORS } from '../../data/platforms';

export function PlatformTab({ ctx }) {
  const {
    availablePlatforms, gpu, handleVendorChange, platform, selectedPlatformId, selectedVendor,
    setSelectedPlatformId,
  } = ctx;
  return (
    <>
      <Card
        icon={Building2}
        title="2. Datacenter Platform Selection"
        right={
          <SegmentedToggle
            value={selectedVendor}
            onChange={handleVendorChange}
            options={PLATFORM_VENDORS.map(v => ({ value: v.id, label: v.id === 'cisco' ? 'Cisco Solutions' : 'NVIDIA DGX' }))}
          />
        }
        className="space-y-4"
      >
        {/* Platform Dropdown */}
        <Field
          label={`Select ${selectedVendor === 'cisco' ? 'AI Server Architecture' : 'NVIDIA DGX System'}`}
          helper={
            <InfoHelper
              title={
                platform.id?.includes('smci')
                  ? 'Cisco Secure AI Factory with Supermicro Compute'
                  : selectedVendor === 'cisco'
                  ? 'Cisco UCS & Nexus AI Platform'
                  : 'NVIDIA DGX SuperPOD Architecture'
              }
              text={
                platform.id?.includes('smci')
                  ? 'Supermicro HGX GPU SuperServers (SYS-821GE-TNHR / SYS-A21GE-NBRT) integrated into the Cisco Secure AI Factory reference architecture. Features dual Intel Xeon Scalable processors, up to 8TB DDR5 system memory (32 DIMMs), and high-density front NVMe bays, paired with Cisco Nexus 9000 deep-buffer RoCEv2 fabric and unified Intersight management.'
                  : selectedVendor === 'cisco'
                  ? 'Cisco UCS C885A M8 pairs 8x NVIDIA HGX SXM GPUs with dual AMD EPYC processors and Cisco Nexus 9000 deep-buffer RoCEv2 switches. Managed centrally via Cisco Intersight and Nexus Dashboard (NDFC).'
                  : 'NVIDIA DGX SuperPOD is NVIDIA’s turnkey AI supercomputing reference architecture. Features DGX 8U chassis with dual Intel Xeon processors, ConnectX-7/8 OSFP NICs, and choice of Quantum-2 InfiniBand or Spectrum-4 Ethernet.'
              }
              whyItMatters={
                platform.id?.includes('smci')
                  ? 'Combines Supermicro’s extreme memory expandability (up to 8TB RAM for CPU dataset staging/offload) and Blackwell 10U thermal design with enterprise Cisco Nexus lossless networking and Intersight governance.'
                  : selectedVendor === 'cisco'
                  ? 'Ideal for enterprise datacenters wanting seamless integration into existing Cisco network infrastructure with automated RoCEv2 buffer tuning.'
                  : 'Ideal for pure AI supercomputing clusters requiring turnkey vendor support directly from NVIDIA.'
              }
            />
          }
        >
          <select
            value={selectedPlatformId}
            onChange={(e) => setSelectedPlatformId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-sky-500 font-mono"
          >
            {selectedVendor === 'cisco' ? (
              <>
                <optgroup label="Cisco UCS Rack Servers (AMD EPYC)">
                  {availablePlatforms
                    .filter((p) => !p.id.includes('smci') && !p.id.includes('x-series'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                    ))}
                </optgroup>
                <optgroup label="Cisco UCS X-Series (Modular 7U Blade)">
                  {availablePlatforms
                    .filter((p) => p.id.includes('x-series'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                    ))}
                </optgroup>
                <optgroup label="Cisco Secure AI Factory (Supermicro + Intel Xeon)">
                  {availablePlatforms
                    .filter((p) => p.id.includes('smci'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                    ))}
                </optgroup>
              </>
            ) : (
              <>
                <optgroup label="NVIDIA DGX SuperPOD (Turnkey)">
                  {availablePlatforms
                    .filter((p) => p.id.includes('dgx'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                    ))}
                </optgroup>
                <optgroup label="NVIDIA HGX (Generic OEM Reference Design)">
                  {availablePlatforms
                    .filter((p) => p.id.includes('hgx'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                    ))}
                </optgroup>
                <optgroup label="NVIDIA MGX (Grace Superchip Reference Design)">
                  {availablePlatforms
                    .filter((p) => p.id.includes('mgx'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.formFactor}</option>
                    ))}
                </optgroup>
              </>
            )}
          </select>
        </Field>

        {/* Platform Specifications KPI Row */}
        <KpiRow>
          <Kpi label="Accelerator Payload" value={`${platform.gpusPerChassis}x`} sub={`${gpu.vramGb}GB VRAM/GPU`} tone="accent" />
          <Kpi label="Form Factor" value={platform.formFactor} sub={`${platform.chassisHeightRu} RU`} tone="accent" />
          <Kpi label="Chassis Power" value={`${platform.chassisTdpKw} kW`} sub="Peak load" tone="warn" />
        </KpiRow>

        {/* Host Processor & Memory Info */}
        <div className="p-3 bg-zinc-950/60 border border-zinc-800/70 rounded-lg">
          <Rows>
            <Row k="Host CPUs" v={platform.hostCpu} mono={false} />
            <Row k="Host Memory" v={platform.systemRam} mono={false} />
            <Row k="Host I/O" v={platform.hostNics} mono={false} />
          </Rows>
        </div>
      </Card>
    </>
  );
}
