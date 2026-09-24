/**
 * Security & Compliance Control Domain Test Suite (Phase 10 of the architecture roadmap).
 * Validates evaluateControlDomains()'s derivation logic against representative architectural
 * configurations, and sanity-checks the COMPLIANCE_FRAMEWORKS / CONTROL_DOMAINS catalogs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { COMPLIANCE_FRAMEWORKS, CONTROL_DOMAINS, STATUS, evaluateControlDomains } from '../src/data/security.js';

const getDomain = (results, domainId) => results.find(r => r.domainId === domainId);
const domainIds = CONTROL_DOMAINS.map(d => d.id);

describe('1. Data Catalog Sanity', () => {
  it('every compliance framework has an id, name, and focus', () => {
    for (const f of COMPLIANCE_FRAMEWORKS) {
      assert.ok(f.id && f.name && f.focus, `framework ${JSON.stringify(f)} missing a field`);
    }
  });

  it('every control domain has an id, name, description, and calculatorTieIn', () => {
    for (const d of CONTROL_DOMAINS) {
      assert.ok(d.id && d.name && d.description && d.calculatorTieIn, `domain ${JSON.stringify(d)} missing a field`);
    }
  });

  it('control domain ids are unique', () => {
    assert.equal(new Set(domainIds).size, domainIds.length);
  });
});

describe('2. Result Shape & Completeness', () => {
  it('returns exactly one result per control domain, covering every domain id', () => {
    const results = evaluateControlDomains({});
    assert.equal(results.length, CONTROL_DOMAINS.length);
    const resultDomainIds = results.map(r => r.domainId).sort();
    assert.deepEqual(resultDomainIds, [...domainIds].sort());
  });

  it('every result has a valid status and a non-empty note', () => {
    const results = evaluateControlDomains({ workloadType: 'inference', haDrEnabled: true, haDrTierId: 'multi-az', ingressEnabled: true, ingressTierId: 'api-gateway', guardrailsEnabled: true, migEnabled: true, mlopsEnabled: true, mlopsStrategyId: 'canary-release' });
    const validStatuses = Object.values(STATUS);
    for (const r of results) {
      assert.ok(validStatuses.includes(r.status), `invalid status ${r.status}`);
      assert.ok(r.note && r.note.length > 0);
    }
  });
});

describe('3. Data Residency & Network Exposure', () => {
  it('no ingress -> strong (traffic never leaves the network boundary)', () => {
    const r = getDomain(evaluateControlDomains({ ingressEnabled: false }), 'data-residency');
    assert.equal(r.status, STATUS.STRONG);
  });

  it('cdn-edge ingress -> partial (third-party PoP in the request path)', () => {
    const r = getDomain(evaluateControlDomains({ ingressEnabled: true, ingressTierId: 'cdn-edge' }), 'data-residency');
    assert.equal(r.status, STATUS.PARTIAL);
  });

  it('cloud-managed-lb ingress -> partial (third-party control plane)', () => {
    const r = getDomain(evaluateControlDomains({ ingressEnabled: true, ingressTierId: 'cloud-managed-lb' }), 'data-residency');
    assert.equal(r.status, STATUS.PARTIAL);
  });

  it('self-hosted ingress tiers -> strong', () => {
    for (const tier of ['software-lb', 'hardware-adc', 'api-gateway']) {
      const r = getDomain(evaluateControlDomains({ ingressEnabled: true, ingressTierId: tier }), 'data-residency');
      assert.equal(r.status, STATUS.STRONG, `tier ${tier} should be strong`);
    }
  });
});

describe('4. Multi-Tenant / Workload Isolation', () => {
  it('training workload -> not applicable', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'training' }), 'tenant-isolation');
    assert.equal(r.status, STATUS.NOT_APPLICABLE);
  });

  it('inference with MIG enabled -> strong', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'inference', migEnabled: true }), 'tenant-isolation');
    assert.equal(r.status, STATUS.STRONG);
  });

  it('inference without MIG -> gap', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'inference', migEnabled: false }), 'tenant-isolation');
    assert.equal(r.status, STATUS.GAP);
  });
});

describe('5. Access Control & Perimeter Enforcement', () => {
  it('training with no ingress -> not applicable', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'training', ingressEnabled: false }), 'access-control');
    assert.equal(r.status, STATUS.NOT_APPLICABLE);
  });

  it('inference with no ingress -> gap', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'inference', ingressEnabled: false }), 'access-control');
    assert.equal(r.status, STATUS.GAP);
  });

  it('api-gateway ingress -> strong', () => {
    const r = getDomain(evaluateControlDomains({ ingressEnabled: true, ingressTierId: 'api-gateway' }), 'access-control');
    assert.equal(r.status, STATUS.STRONG);
  });

  it('non-gateway ingress tiers -> partial', () => {
    for (const tier of ['software-lb', 'hardware-adc', 'cloud-managed-lb', 'cdn-edge']) {
      const r = getDomain(evaluateControlDomains({ ingressEnabled: true, ingressTierId: tier }), 'access-control');
      assert.equal(r.status, STATUS.PARTIAL, `tier ${tier} should be partial`);
    }
  });
});

describe('6. Content Safety & Output Governance', () => {
  it('guardrails enabled -> strong', () => {
    const r = getDomain(evaluateControlDomains({ guardrailsEnabled: true }), 'content-safety');
    assert.equal(r.status, STATUS.STRONG);
  });

  it('guardrails disabled, inference -> gap', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'inference', guardrailsEnabled: false }), 'content-safety');
    assert.equal(r.status, STATUS.GAP);
  });

  it('guardrails disabled, training -> not applicable', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'training', guardrailsEnabled: false }), 'content-safety');
    assert.equal(r.status, STATUS.NOT_APPLICABLE);
  });
});

describe('7. Change Management & Rollback', () => {
  it('MLOps enabled -> strong, and note names the strategy', () => {
    const r = getDomain(evaluateControlDomains({ mlopsEnabled: true, mlopsStrategyId: 'shadow-deployment' }), 'change-management');
    assert.equal(r.status, STATUS.STRONG);
    assert.match(r.note, /shadow deployment/);
  });

  it('MLOps disabled, inference -> gap', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'inference', mlopsEnabled: false }), 'change-management');
    assert.equal(r.status, STATUS.GAP);
  });

  it('MLOps disabled, training -> not applicable', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'training', mlopsEnabled: false }), 'change-management');
    assert.equal(r.status, STATUS.NOT_APPLICABLE);
  });
});

describe('8. Business Continuity & Disaster Recovery', () => {
  it('HA/DR disabled, inference -> gap', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'inference', haDrEnabled: false }), 'business-continuity');
    assert.equal(r.status, STATUS.GAP);
  });

  it('HA/DR disabled, training -> not applicable', () => {
    const r = getDomain(evaluateControlDomains({ workloadType: 'training', haDrEnabled: false }), 'business-continuity');
    assert.equal(r.status, STATUS.NOT_APPLICABLE);
  });

  it('warm-standby and multi-site-active-active -> strong', () => {
    for (const tier of ['warm-standby', 'multi-site-active-active']) {
      const r = getDomain(evaluateControlDomains({ haDrEnabled: true, haDrTierId: tier }), 'business-continuity');
      assert.equal(r.status, STATUS.STRONG, `tier ${tier} should be strong`);
    }
  });

  it('multi-az and pilot-light -> partial', () => {
    for (const tier of ['multi-az', 'pilot-light']) {
      const r = getDomain(evaluateControlDomains({ haDrEnabled: true, haDrTierId: tier }), 'business-continuity');
      assert.equal(r.status, STATUS.PARTIAL, `tier ${tier} should be partial`);
    }
  });

  it('backup-restore -> gap (weakest RTO/RPO of the DR tiers)', () => {
    const r = getDomain(evaluateControlDomains({ haDrEnabled: true, haDrTierId: 'backup-restore' }), 'business-continuity');
    assert.equal(r.status, STATUS.GAP);
  });
});

describe('9. Encryption at Rest & In Transit', () => {
  it('is always out of scope, regardless of other facts', () => {
    const r1 = getDomain(evaluateControlDomains({}), 'encryption');
    const r2 = getDomain(evaluateControlDomains({ haDrEnabled: true, migEnabled: true, guardrailsEnabled: true }), 'encryption');
    assert.equal(r1.status, STATUS.OUT_OF_SCOPE);
    assert.equal(r2.status, STATUS.OUT_OF_SCOPE);
  });
});
