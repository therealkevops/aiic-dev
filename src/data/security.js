// Security & Compliance reference data (Phase 10): maps the architectural choices already sized
// elsewhere in this calculator (HA/DR tier, ingress tier, guardrails, MIG isolation, MLOps rollout
// strategy) onto the control domains that common compliance frameworks evaluate. This is
// architectural guidance for the Architecture Guide, not a certified attestation -- achieving a
// framework's certification requires audited policies, procedures, and evidence far beyond
// anything a sizing calculator can size or verify. No new state is added to the calculator UI;
// this only extends the Glossary/Architecture Guide's documentation.

export const COMPLIANCE_FRAMEWORKS = [
  { id: 'soc2', name: 'SOC 2 Type II', focus: 'Security, availability & confidentiality of a service organization' },
  { id: 'hipaa', name: 'HIPAA Security Rule', focus: 'Protected Health Information (PHI)' },
  { id: 'pci-dss', name: 'PCI-DSS', focus: 'Cardholder data environments' },
  { id: 'fedramp', name: 'FedRAMP Moderate / High', focus: 'US federal government cloud workloads' },
  { id: 'iso27001', name: 'ISO/IEC 27001', focus: 'Information security management systems' },
  { id: 'gdpr', name: 'GDPR', focus: 'EU personal data processing' },
];

export const CONTROL_DOMAINS = [
  {
    id: 'data-residency',
    name: 'Data Residency & Network Exposure',
    description: 'Whether inference/training traffic and data ever transit third-party infrastructure on the way to or from the serving cluster.',
    calculatorTieIn: 'Ingress & Edge tab -- self-hosted (software LB / hardware ADC / API gateway) vs. managed/CDN ingress tiers.',
  },
  {
    id: 'tenant-isolation',
    name: 'Multi-Tenant / Workload Isolation',
    description: 'Whether concurrent workloads sharing physical GPUs are isolated at the hardware level, not just by process or container boundaries.',
    calculatorTieIn: 'MIG Partitioning tab -- hardware-enforced GPU instance isolation.',
  },
  {
    id: 'access-control',
    name: 'Access Control & Perimeter Enforcement',
    description: 'Whether the deployment authenticates callers and enforces rate limits at the cluster boundary, rather than trusting the network.',
    calculatorTieIn: 'Ingress & Edge tab -- API gateway tiers natively add auth/rate-limiting; plain load balancers do not.',
  },
  {
    id: 'content-safety',
    name: 'Content Safety & Output Governance',
    description: 'Whether unsafe, off-policy, or adversarial input/output is automatically screened before it reaches a user or downstream system.',
    calculatorTieIn: 'Guardrails tab -- synchronous input/output classification.',
  },
  {
    id: 'change-management',
    name: 'Change Management & Rollback',
    description: 'Whether a new model version is validated against a limited blast radius before it is promoted to all live traffic.',
    calculatorTieIn: 'MLOps Lifecycle tab -- canary/shadow/blue-green validation pool sizing.',
  },
  {
    id: 'business-continuity',
    name: 'Business Continuity & Disaster Recovery',
    description: 'Whether a site, availability-zone, or regional failure has an automatic, bounded-time failover path.',
    calculatorTieIn: 'HA/DR tab -- RTO/RPO-driven resilience tier.',
  },
  {
    id: 'encryption',
    name: 'Encryption at Rest & In Transit',
    description: 'Whether stored data and network traffic are encrypted, and how keys are managed.',
    calculatorTieIn: 'Out of scope for this calculator -- it sizes storage capacity and network throughput, not the cipher suites or key-management layered on top.',
  },
];

export const STATUS = {
  STRONG: 'strong',
  PARTIAL: 'partial',
  GAP: 'gap',
  NOT_APPLICABLE: 'not-applicable',
  OUT_OF_SCOPE: 'out-of-scope',
};

const STRONG_HA_DR_TIERS = ['warm-standby', 'multi-site-active-active'];
const PARTIAL_HA_DR_TIERS = ['multi-az', 'pilot-light'];

const MLOPS_STRATEGY_LABELS = {
  'canary-release': 'canary release',
  'shadow-deployment': 'shadow deployment',
  'blue-green-cutover': 'blue/green cutover',
};

/**
 * Derives an illustrative control-domain posture (strong / partial / gap / not-applicable /
 * out-of-scope) from the same architectural facts this calculator already sizes for a given
 * preset or configuration. Pure function of its inputs -- no calculator state is read directly,
 * so this is safe to call from documentation content that doesn't have access to live App state.
 */
export function evaluateControlDomains(facts) {
  const {
    workloadType = 'inference',
    haDrEnabled = false,
    haDrTierId = null,
    ingressEnabled = false,
    ingressTierId = null,
    guardrailsEnabled = false,
    migEnabled = false,
    mlopsEnabled = false,
    mlopsStrategyId = null,
  } = facts;

  const isTraining = workloadType === 'training';
  const results = [];

  // 1. Data residency & network exposure
  if (!ingressEnabled) {
    results.push({
      domainId: 'data-residency',
      status: STATUS.STRONG,
      note: 'No external ingress is sized -- traffic never leaves the on-prem/internal network boundary.',
    });
  } else if (ingressTierId === 'cdn-edge' || ingressTierId === 'cloud-managed-lb') {
    results.push({
      domainId: 'data-residency',
      status: STATUS.PARTIAL,
      note: ingressTierId === 'cdn-edge'
        ? "CDN edge PoPs terminate TLS on third-party infrastructure before requests reach the origin cluster -- verify the CDN vendor's data-handling agreement."
        : 'A managed cloud load balancer is still a third-party control plane in the request path, even though generation stays on-prem.',
    });
  } else {
    results.push({
      domainId: 'data-residency',
      status: STATUS.STRONG,
      note: 'Self-hosted ingress (software LB, hardware ADC, or API gateway) keeps the entire request path inside owned infrastructure.',
    });
  }

  // 2. Multi-tenant / workload isolation
  if (isTraining) {
    results.push({
      domainId: 'tenant-isolation',
      status: STATUS.NOT_APPLICABLE,
      note: 'A single training job with no concurrent external tenants has no multi-tenancy surface to isolate.',
    });
  } else if (migEnabled) {
    results.push({
      domainId: 'tenant-isolation',
      status: STATUS.STRONG,
      note: 'MIG partitioning provides hardware-enforced isolation between workloads sharing a physical GPU.',
    });
  } else {
    results.push({
      domainId: 'tenant-isolation',
      status: STATUS.GAP,
      note: 'MIG partitioning is not enabled in this configuration -- workloads share full GPUs with only software-level (process/container) isolation.',
    });
  }

  // 3. Access control & perimeter enforcement
  if (!ingressEnabled) {
    results.push({
      domainId: 'access-control',
      status: isTraining ? STATUS.NOT_APPLICABLE : STATUS.GAP,
      note: isTraining
        ? 'Training clusters have no live request path to authenticate.'
        : 'No ingress tier is sized -- authentication, rate-limiting, and mTLS enforcement must be provided by a layer this preset does not include.',
    });
  } else if (ingressTierId === 'api-gateway') {
    results.push({
      domainId: 'access-control',
      status: STATUS.STRONG,
      note: 'An API gateway tier natively provides authentication, rate-limiting, and request/response policy enforcement at the cluster boundary.',
    });
  } else {
    results.push({
      domainId: 'access-control',
      status: STATUS.PARTIAL,
      note: 'A load balancer / ADC / CDN tier terminates TLS and routes traffic, but does not itself enforce API-level authentication or rate-limiting -- pair it with an auth layer.',
    });
  }

  // 4. Content safety & output governance
  results.push({
    domainId: 'content-safety',
    status: guardrailsEnabled ? STATUS.STRONG : (isTraining ? STATUS.NOT_APPLICABLE : STATUS.GAP),
    note: guardrailsEnabled
      ? 'Synchronous input/output guardrail classification is sized into this deployment.'
      : (isTraining
        ? 'Training jobs produce no live user-facing output to classify.'
        : 'No guardrail model is sized -- unsafe or off-policy input/output is not automatically screened.'),
  });

  // 5. Change management & rollback
  results.push({
    domainId: 'change-management',
    status: mlopsEnabled ? STATUS.STRONG : (isTraining ? STATUS.NOT_APPLICABLE : STATUS.GAP),
    note: mlopsEnabled
      ? `A ${MLOPS_STRATEGY_LABELS[mlopsStrategyId] || 'validation'} pool sizes a bounded-blast-radius rollout before a new model version reaches all live traffic.`
      : (isTraining
        ? 'A training run has no live model version to roll forward or back.'
        : 'No validation pool is sized -- a new model version would be promoted directly to all live traffic with no staged rollback path.'),
  });

  // 6. Business continuity & disaster recovery
  if (!haDrEnabled) {
    results.push({
      domainId: 'business-continuity',
      status: isTraining ? STATUS.NOT_APPLICABLE : STATUS.GAP,
      note: isTraining
        ? 'Training continuity is a checkpoint/resume concern (see Storage), not a live-replica one.'
        : 'No HA/DR tier is sized -- a site or availability-zone failure has no automatic failover path.',
    });
  } else {
    const status = STRONG_HA_DR_TIERS.includes(haDrTierId)
      ? STATUS.STRONG
      : PARTIAL_HA_DR_TIERS.includes(haDrTierId)
        ? STATUS.PARTIAL
        : STATUS.GAP; // backup-restore: hours-to-days RTO is the weakest DR tier
    results.push({
      domainId: 'business-continuity',
      status,
      note: `Resilience tier: ${haDrTierId}.`,
    });
  }

  // 7. Encryption at rest & in transit -- always out of scope for this calculator
  results.push({
    domainId: 'encryption',
    status: STATUS.OUT_OF_SCOPE,
    note: 'This calculator sizes storage capacity and network throughput, not the cipher suites or key-management layered on top -- verify encryption-at-rest and in-transit configuration directly with your storage and network vendor.',
  });

  return results;
}
