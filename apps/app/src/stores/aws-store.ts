import { create } from "zustand";
import type { AwsAccount } from "@/types";

interface AwsState {
  accounts: AwsAccount[];
  selectedAccountId: string | null;
  isLoading: boolean;

  // Actions
  setAccounts: (accounts: AwsAccount[]) => void;
  addAccount: (account: AwsAccount) => void;
  updateAccount: (id: string, updates: Partial<AwsAccount>) => void;
  removeAccount: (id: string) => void;
  selectAccount: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAwsStore = create<AwsState>((set) => ({
  accounts: [],
  selectedAccountId: null,
  isLoading: false,

  setAccounts: (accounts) => set({ accounts }),

  addAccount: (account) =>
    set((state) => ({
      accounts: [...state.accounts, account],
    })),

  updateAccount: (id, updates) =>
    set((state) => ({
      accounts: state.accounts.map((acc) =>
        acc.id === id ? { ...acc, ...updates } : acc
      ),
    })),

  removeAccount: (id) =>
    set((state) => ({
      accounts: state.accounts.filter((acc) => acc.id !== id),
      selectedAccountId:
        state.selectedAccountId === id ? null : state.selectedAccountId,
    })),

  selectAccount: (id) => set({ selectedAccountId: id }),

  setLoading: (loading) => set({ isLoading: loading }),
}));
