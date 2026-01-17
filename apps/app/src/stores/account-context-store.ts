import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountContextState {
  // null = Organization Overview (all accounts)
  // string = specific account ID
  currentAccountId: string | null;

  // Actions
  setCurrentAccount: (accountId: string | null) => void;
  clearAccountContext: () => void;
}

export const useAccountContextStore = create<AccountContextState>()(
  persist(
    (set) => ({
      currentAccountId: null,

      setCurrentAccount: (accountId) => set({ currentAccountId: accountId }),

      clearAccountContext: () => set({ currentAccountId: null }),
    }),
    {
      name: "scanorbit:account-context",
    }
  )
);
