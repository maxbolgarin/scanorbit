import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/config.js', () => ({
  listmonkConfig: {
    lists: {
      coldLeads: 1,
      subscribers: 2,
      freeNew: 3,
      freeScanned: 4,
      trialNew: 5,
      trialActive: 6,
      paidPro: 7,
      paidTeam: 8,
    },
    templates: {
      coldDay0Pain: 101,
      coldDay4Gdpr: 102,
      coldDay10Breakup: 103,
      subsDay0Welcome: 104,
      subsDay3Security: 105,
      subsDay7Cost: 106,
      subsDay11Gdpr: 107,
      subsDay16SocialProof: 108,
      subsDay21FinalCta: 109,
      freeNewDay0Welcome: 110,
      freeNewDay2Security: 111,
      freeNewDay5Value: 112,
      freeScannedDay0Results: 113,
      freeScannedDay2Critical: 114,
      freeScannedDay5Cost: 115,
      freeScannedDay10Breakup: 116,
      trialNewDay0Welcome: 117,
      trialNewDay3Stuck: 118,
      trialActiveDay3Deepen: 119,
      trialActiveDay5Warning: 120,
      trialActiveDay6Lastday: 121,
      trialActiveDay9Winback: 122,
      paidProDay0Welcome: 123,
      paidTeamDay0Welcome: 124,
    },
  },
}));

import { SEQUENCES, type DripSequence } from '../../services/dripConfig.js';

describe('dripConfig', () => {
  describe('SEQUENCES structure', () => {
    it('has expected sequence names', () => {
      const names = SEQUENCES.map(s => s.name);
      expect(names).toContain('free-new');
      expect(names).toContain('free-scanned');
      expect(names).toContain('trial-new');
      expect(names).toContain('trial-active');
      expect(names).toContain('subscribers');
      expect(names).toContain('cold-leads');
      expect(names).toContain('paid-pro');
      expect(names).toContain('paid-team');
    });

    it('all sequences have valid listIds (> 0)', () => {
      for (const seq of SEQUENCES) {
        expect(seq.listId).toBeGreaterThan(0);
      }
    });

    it('all sequences have at least one step', () => {
      for (const seq of SEQUENCES) {
        expect(seq.steps.length).toBeGreaterThan(0);
      }
    });

    it('all steps have valid templateIds (> 0)', () => {
      for (const seq of SEQUENCES) {
        for (const step of seq.steps) {
          expect(step.templateId).toBeGreaterThan(0);
        }
      }
    });

    it('steps have non-negative day values', () => {
      for (const seq of SEQUENCES) {
        for (const step of seq.steps) {
          expect(step.day).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('days are unique within each sequence', () => {
      for (const seq of SEQUENCES) {
        const days = seq.steps.map(s => s.day);
        expect(new Set(days).size).toBe(days.length);
      }
    });

    it('days are in ascending order within each sequence', () => {
      for (const seq of SEQUENCES) {
        for (let i = 1; i < seq.steps.length; i++) {
          expect(seq.steps[i].day).toBeGreaterThan(seq.steps[i - 1].day);
        }
      }
    });

    it('templateIds are unique across all sequences', () => {
      const allTemplateIds = SEQUENCES.flatMap(s => s.steps.map(st => st.templateId));
      expect(new Set(allTemplateIds).size).toBe(allTemplateIds.length);
    });

    it('sequences with dateAttrib have the field set', () => {
      const withDateAttrib = SEQUENCES.filter(s => s.dateAttrib);
      expect(withDateAttrib.length).toBeGreaterThan(0);
      for (const seq of withDateAttrib) {
        expect(typeof seq.dateAttrib).toBe('string');
        expect(seq.dateAttrib!.length).toBeGreaterThan(0);
      }
    });

    it('free-scanned uses scan_completed_at dateAttrib', () => {
      const freeScanned = SEQUENCES.find(s => s.name === 'free-scanned');
      expect(freeScanned?.dateAttrib).toBe('scan_completed_at');
    });

    it('trial-active uses trial_started_at dateAttrib', () => {
      const trialActive = SEQUENCES.find(s => s.name === 'trial-active');
      expect(trialActive?.dateAttrib).toBe('trial_started_at');
    });

    it('free-new uses signup_at dateAttrib', () => {
      const freeNew = SEQUENCES.find(s => s.name === 'free-new');
      expect(freeNew?.dateAttrib).toBe('signup_at');
    });

    it('trial-new uses trial_started_at dateAttrib', () => {
      const trialNew = SEQUENCES.find(s => s.name === 'trial-new');
      expect(trialNew?.dateAttrib).toBe('trial_started_at');
    });

    it('cold-leads steps all have custom fromEmail', () => {
      const coldLeads = SEQUENCES.find(s => s.name === 'cold-leads');
      expect(coldLeads).toBeDefined();
      for (const step of coldLeads!.steps) {
        expect(step.fromEmail).toBeDefined();
        expect(step.fromEmail).toContain('Maksim');
      }
    });
  });
});
