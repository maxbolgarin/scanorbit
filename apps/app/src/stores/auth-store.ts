import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Org } from "@/types";
import * as api from "@/lib/api";

interface AuthState {
  user: User | null;
  org: Org | null;
  orgs: Org[];
  isAuthenticated: boolean;
  hasOrg: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  setOrg: (org: Org) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  updateUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      orgs: [],
      isAuthenticated: false,
      hasOrg: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.login({ email, password });
          // Pick first org as active org
          const activeOrg = response.orgs.length > 0 ? response.orgs[0] : null;
          set({
            user: response.user,
            org: activeOrg,
            orgs: response.orgs,
            isAuthenticated: true,
            hasOrg: !!activeOrg,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Login failed",
            isLoading: false,
          });
          throw err;
        }
      },

      signup: async (email: string, password: string, fullName?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.signup({ email, password, fullName });
          // Signup returns single org (or null if not created)
          const orgs = response.org ? [response.org] : [];
          set({
            user: response.user,
            org: response.org,
            orgs,
            isAuthenticated: true,
            hasOrg: !!response.org,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Signup failed",
            isLoading: false,
          });
          throw err;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await api.logout();
        } finally {
          set({
            user: null,
            org: null,
            orgs: [],
            isAuthenticated: false,
            hasOrg: false,
            isLoading: false,
            error: null,
          });
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const response = await api.getMe();
          const currentOrg = get().org;
          // Keep current org if still in orgs list, otherwise pick first
          const activeOrg = response.orgs.find(o => o.id === currentOrg?.id)
            || (response.orgs.length > 0 ? response.orgs[0] : null);
          set({
            user: response.user,
            org: activeOrg,
            orgs: response.orgs,
            isAuthenticated: true,
            hasOrg: !!activeOrg,
            isLoading: false,
          });
        } catch {
          set({
            user: null,
            org: null,
            orgs: [],
            isAuthenticated: false,
            hasOrg: false,
            isLoading: false,
          });
        }
      },

      switchOrg: async (orgId: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.switchOrg(orgId);
          const orgs = get().orgs;
          const newOrg = orgs.find(o => o.id === orgId);
          if (newOrg) {
            set({
              org: newOrg,
              hasOrg: true,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to switch organization",
            isLoading: false,
          });
          throw err;
        }
      },

      setOrg: (org: Org) => {
        set({ org, hasOrg: true, orgs: [...get().orgs, org] });
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setToken: (_token: string) => {
        // Token is managed via httpOnly cookies, nothing to store
        // This method is kept for API compatibility
      },

      updateUser: (user: User) => {
        set({ user });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        hasOrg: state.hasOrg,
      }),
    }
  )
);
