import { describe, it, expect } from 'vitest';
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

    it('all sequences have at least one step', () => {
      for (const seq of SEQUENCES) {
        expect(seq.steps.length).toBeGreaterThan(0);
      }
    });

    it('all steps have non-empty template strings', () => {
      for (const seq of SEQUENCES) {
        for (const step of seq.steps) {
          expect(typeof step.template).toBe('string');
          expect(step.template.length).toBeGreaterThan(0);
        }
      }
    });

    it('all steps have non-empty subject strings', () => {
      for (const seq of SEQUENCES) {
        for (const step of seq.steps) {
          expect(typeof step.subject).toBe('string');
          expect(step.subject.length).toBeGreaterThan(0);
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

    it('templates are unique across all sequences', () => {
      const allTemplateKeys = SEQUENCES.flatMap(s =>
        s.steps.map(st => `${s.name}/${st.template}`),
      );
      expect(new Set(allTemplateKeys).size).toBe(allTemplateKeys.length);
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

    it('subscribers uses subscribed_at dateAttrib', () => {
      const subscribers = SEQUENCES.find(s => s.name === 'subscribers');
      expect(subscribers?.dateAttrib).toBe('subscribed_at');
    });

    it('cold-leads uses imported_at dateAttrib', () => {
      const coldLeads = SEQUENCES.find(s => s.name === 'cold-leads');
      expect(coldLeads?.dateAttrib).toBe('imported_at');
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
