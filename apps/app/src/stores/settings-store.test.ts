import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useViewingSettingsStore } from './settings-store';
import type { Finding, FindingSeverity, FindingType } from '@/types';

const DEFAULT_SETTINGS = {
  requiredTags: ['Environment', 'Owner', 'CostCenter'],
  hiddenFindingTypes: [] as FindingType[],
  hideTrivial: false,
};

const mockFinding = (overrides: Partial<Finding> = {}): Finding => ({
  id: 'f-1',
  orgId: 'org-1',
  awsAccountId: '123456789012',
  resourceId: 'r-1',
  certificateId: null,
  type: 'orphaned_volume',
  severity: 'medium',
  status: 'open',
  summary: 'Orphaned EBS volume',
  details: {},
  ...overrides,
} as Finding);

describe('useViewingSettingsStore', () => {
  beforeEach(() => {
    act(() => {
      useViewingSettingsStore.getState().reset();
    });
  });

  describe('setSettings', () => {
    it('replaces settings entirely', () => {
      const newSettings = {
        requiredTags: ['Project'],
        hiddenFindingTypes: ['orphaned_volume' as FindingType],
        hideTrivial: true,
      };
      act(() => useViewingSettingsStore.getState().setSettings(newSettings));
      expect(useViewingSettingsStore.getState().settings).toEqual(newSettings);
    });
  });

  describe('updateSettings', () => {
    it('shallow merges updates into settings', () => {
      act(() => useViewingSettingsStore.getState().updateSettings({ hideTrivial: true }));
      const { settings } = useViewingSettingsStore.getState();
      expect(settings.hideTrivial).toBe(true);
      // Other fields remain
      expect(settings.requiredTags).toEqual(DEFAULT_SETTINGS.requiredTags);
    });

    it('can update multiple fields at once', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({
          hideTrivial: true,
          requiredTags: ['NewTag'],
        })
      );
      const { settings } = useViewingSettingsStore.getState();
      expect(settings.hideTrivial).toBe(true);
      expect(settings.requiredTags).toEqual(['NewTag']);
    });
  });

  describe('isTypeHidden', () => {
    it('returns false when type is not in hidden list', () => {
      expect(useViewingSettingsStore.getState().isTypeHidden('orphaned_volume')).toBe(false);
    });

    it('returns true when type is in hidden list', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({
          hiddenFindingTypes: ['orphaned_volume'],
        })
      );
      expect(useViewingSettingsStore.getState().isTypeHidden('orphaned_volume')).toBe(true);
    });

    it('returns false for a type not in the hidden list', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({
          hiddenFindingTypes: ['orphaned_volume'],
        })
      );
      expect(useViewingSettingsStore.getState().isTypeHidden('ssl_expiry')).toBe(false);
    });
  });

  describe('shouldHideFinding', () => {
    it('returns false for a visible finding', () => {
      const finding = mockFinding();
      expect(useViewingSettingsStore.getState().shouldHideFinding(finding)).toBe(false);
    });

    it('returns true when finding type is hidden', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({
          hiddenFindingTypes: ['orphaned_volume'],
        })
      );
      const finding = mockFinding({ type: 'orphaned_volume' });
      expect(useViewingSettingsStore.getState().shouldHideFinding(finding)).toBe(true);
    });

    it('returns true for trivial finding when hideTrivial is enabled', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({ hideTrivial: true })
      );
      const finding = mockFinding({ severity: 'trivial' });
      expect(useViewingSettingsStore.getState().shouldHideFinding(finding)).toBe(true);
    });

    it('returns false for trivial finding when hideTrivial is disabled', () => {
      const finding = mockFinding({ severity: 'trivial' });
      expect(useViewingSettingsStore.getState().shouldHideFinding(finding)).toBe(false);
    });

    it('returns false for non-trivial finding when hideTrivial is enabled', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({ hideTrivial: true })
      );
      const finding = mockFinding({ severity: 'high' });
      expect(useViewingSettingsStore.getState().shouldHideFinding(finding)).toBe(false);
    });
  });

  describe('getVisibleFindings', () => {
    const findings: { type: FindingType; severity: FindingSeverity }[] = [
      { type: 'orphaned_volume', severity: 'medium' },
      { type: 'ssl_expiry', severity: 'high' },
      { type: 'orphaned_eip', severity: 'trivial' },
      { type: 'orphaned_volume', severity: 'trivial' },
    ];

    it('returns all findings when no filters are active', () => {
      const result = useViewingSettingsStore.getState().getVisibleFindings(findings);
      expect(result).toHaveLength(4);
    });

    it('filters out hidden finding types', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({
          hiddenFindingTypes: ['orphaned_volume'],
        })
      );
      const result = useViewingSettingsStore.getState().getVisibleFindings(findings);
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.type !== 'orphaned_volume')).toBe(true);
    });

    it('filters out trivial findings when hideTrivial is enabled', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({ hideTrivial: true })
      );
      const result = useViewingSettingsStore.getState().getVisibleFindings(findings);
      expect(result).toHaveLength(2);
      expect(result.every((f) => f.severity !== 'trivial')).toBe(true);
    });

    it('combines type hiding and trivial hiding', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({
          hiddenFindingTypes: ['ssl_expiry'],
          hideTrivial: true,
        })
      );
      const result = useViewingSettingsStore.getState().getVisibleFindings(findings);
      // Should only have orphaned_volume with medium severity
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('orphaned_volume');
      expect(result[0].severity).toBe('medium');
    });

    it('returns empty array when all are filtered', () => {
      act(() =>
        useViewingSettingsStore.getState().updateSettings({
          hiddenFindingTypes: ['orphaned_volume', 'ssl_expiry', 'orphaned_eip'],
          hideTrivial: true,
        })
      );
      const result = useViewingSettingsStore.getState().getVisibleFindings(findings);
      expect(result).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('restores default settings', () => {
      act(() => {
        useViewingSettingsStore.getState().updateSettings({ hideTrivial: true });
        useViewingSettingsStore.getState().setLastSyncedOrgId('org-1');
        useViewingSettingsStore.getState().setLoading(true);
      });
      act(() => useViewingSettingsStore.getState().reset());
      const state = useViewingSettingsStore.getState();
      expect(state.settings).toEqual(DEFAULT_SETTINGS);
      expect(state.isLoading).toBe(false);
      expect(state.lastSyncedOrgId).toBeNull();
    });
  });
});
