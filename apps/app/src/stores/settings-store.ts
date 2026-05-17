import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrgSettings, FindingType, Finding, FindingSeverity } from "@/types";

// Default settings
const DEFAULT_SETTINGS: OrgSettings = {
  requiredTags: ["Environment", "Owner", "CostCenter"],
  hiddenFindingTypes: [],
  hideTrivial: false,
};

interface ViewingSettingsState {
  settings: OrgSettings;
  isLoading: boolean;
  lastSyncedOrgId: string | null;

  // Actions
  setSettings: (settings: OrgSettings) => void;
  updateSettings: (updates: Partial<OrgSettings>) => void;
  setLoading: (isLoading: boolean) => void;
  setLastSyncedOrgId: (orgId: string | null) => void;
  reset: () => void;

  // Computed helpers
  isTypeHidden: (type: FindingType) => boolean;
  shouldHideFinding: (finding: Finding) => boolean;
  getVisibleFindings: <T extends { type: FindingType; severity: FindingSeverity }>(findings: T[]) => T[];
}

export const useViewingSettingsStore = create<ViewingSettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      isLoading: false,
      lastSyncedOrgId: null,

      setSettings: (settings: OrgSettings) => {
        set({ settings });
      },

      updateSettings: (updates: Partial<OrgSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setLastSyncedOrgId: (orgId: string | null) => {
        set({ lastSyncedOrgId: orgId });
      },

      reset: () => {
        set({
          settings: DEFAULT_SETTINGS,
          isLoading: false,
          lastSyncedOrgId: null,
        });
      },

      // Check if a specific finding type should be hidden
      isTypeHidden: (type: FindingType) => {
        const { settings } = get();
        return settings.hiddenFindingTypes.includes(type);
      },

      // Check if a finding should be hidden based on current settings
      shouldHideFinding: (finding: Finding) => {
        const { settings } = get();

        // Hide if type is in hidden list
        if (settings.hiddenFindingTypes.includes(finding.type)) {
          return true;
        }

        // Hide if trivial and hideTrivial is enabled
        if (settings.hideTrivial && finding.severity === "trivial") {
          return true;
        }

        return false;
      },

      // Filter an array of findings based on current settings
      getVisibleFindings: <T extends { type: FindingType; severity: FindingSeverity }>(findings: T[]): T[] => {
        const { settings } = get();

        return findings.filter((finding) => {
          // Hide if type is in hidden list
          if (settings.hiddenFindingTypes.includes(finding.type)) {
            return false;
          }

          // Hide if trivial and hideTrivial is enabled
          if (settings.hideTrivial && finding.severity === "trivial") {
            return false;
          }

          return true;
        });
      },
    }),
    {
      name: "scanorbit:viewing-settings",
      partialize: (state) => ({
        settings: state.settings,
        lastSyncedOrgId: state.lastSyncedOrgId,
      }),
    }
  )
);
