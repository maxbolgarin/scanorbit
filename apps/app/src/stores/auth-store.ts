import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Org } from "@/types";
import * as api from "@/lib/api";

interface AuthState {
  user: User | null;
  org: Org | null;
  isAuthenticated: boolean;
  hasOrg: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  createOrg: (name: string) => Promise<void>;
  setOrg: (org: Org) => void;
  updateUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      org: null,
      isAuthenticated: false,
      hasOrg: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.login({ email, password });
          set({
            user: response.user,
            org: response.org,
            isAuthenticated: true,
            hasOrg: !!response.org,
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

      signup: async (email: string, password: string, name?: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.signup({ email, password, name });
          set({
            user: response.user,
            org: response.org,
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
          set({
            user: response.user,
            org: response.org,
            isAuthenticated: true,
            hasOrg: !!response.org,
            isLoading: false,
          });
        } catch {
          set({
            user: null,
            org: null,
            isAuthenticated: false,
            hasOrg: false,
            isLoading: false,
          });
        }
      },

      createOrg: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
          const org = await api.createOrganization(name);
          set({
            org,
            hasOrg: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to create organization",
            isLoading: false,
          });
          throw err;
        }
      },

      setOrg: (org: Org) => {
        set({ org, hasOrg: true });
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
