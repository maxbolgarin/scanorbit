import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Org, LoginResponseSuccess } from "@/types";
import * as api from "@/lib/api";

interface AuthState {
  user: User | null;
  org: Org | null;
  orgs: Org[];
  isAuthenticated: boolean;
  hasOrg: boolean;
  isLoading: boolean;
  error: string | null;

  // 2FA Challenge State
  requires2FA: boolean;
  challengeToken: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  setOrg: (org: Org) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  updateUser: (user: User) => void;
  clearError: () => void;

  // 2FA Actions
  set2FAChallenge: (challengeToken: string) => void;
  verify2FA: (code: string) => Promise<void>;
  verify2FARecovery: (recoveryCode: string) => Promise<void>;
  clear2FAChallenge: () => void;
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

      // 2FA Challenge State
      requires2FA: false,
      challengeToken: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.login({ email, password });

          // Check if 2FA is required
          if (response.requires2FA) {
            set({
              requires2FA: true,
              challengeToken: response.challengeToken,
              isLoading: false,
            });
            return;
          }

          // Normal login (no 2FA)
          const successResponse = response as LoginResponseSuccess;
          const activeOrg = successResponse.orgs.length > 0 ? successResponse.orgs[0] : null;
          set({
            user: successResponse.user,
            org: activeOrg,
            orgs: successResponse.orgs,
            isAuthenticated: true,
            hasOrg: !!activeOrg,
            isLoading: false,
            requires2FA: false,
            challengeToken: null,
          });
        } catch (err) {
          console.error("Auth store login error:", err);
          const errorMessage = err instanceof Error ? err.message : "Login failed";
          console.log("Auth store setting error:", errorMessage);
          set({
            error: errorMessage,
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
            requires2FA: false,
            challengeToken: null,
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

      refreshAuth: async () => {
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
            hasOrg: !!activeOrg,
          });
        } catch {
          // Silent fail - don't update state on error
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

      // 2FA Actions
      set2FAChallenge: (challengeToken: string) => {
        set({
          requires2FA: true,
          challengeToken,
        });
      },

      verify2FA: async (code: string) => {
        const { challengeToken } = get();
        if (!challengeToken) {
          throw new Error("No 2FA challenge in progress");
        }

        set({ isLoading: true, error: null });
        try {
          const response = await api.verify2FAChallenge(challengeToken, code);

          // Should always be a success response at this point
          if (response.requires2FA) {
            throw new Error("Unexpected 2FA challenge response");
          }

          const successResponse = response as LoginResponseSuccess;
          const activeOrg = successResponse.orgs.length > 0 ? successResponse.orgs[0] : null;
          set({
            user: successResponse.user,
            org: activeOrg,
            orgs: successResponse.orgs,
            isAuthenticated: true,
            hasOrg: !!activeOrg,
            isLoading: false,
            requires2FA: false,
            challengeToken: null,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Verification failed";
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw err;
        }
      },

      verify2FARecovery: async (recoveryCode: string) => {
        const { challengeToken } = get();
        if (!challengeToken) {
          throw new Error("No 2FA challenge in progress");
        }

        set({ isLoading: true, error: null });
        try {
          const response = await api.verify2FARecovery(challengeToken, recoveryCode);

          // Should always be a success response at this point
          if (response.requires2FA) {
            throw new Error("Unexpected 2FA challenge response");
          }

          const successResponse = response as LoginResponseSuccess;
          const activeOrg = successResponse.orgs.length > 0 ? successResponse.orgs[0] : null;
          set({
            user: successResponse.user,
            org: activeOrg,
            orgs: successResponse.orgs,
            isAuthenticated: true,
            hasOrg: !!activeOrg,
            isLoading: false,
            requires2FA: false,
            challengeToken: null,
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Recovery verification failed";
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw err;
        }
      },

      clear2FAChallenge: () => {
        set({
          requires2FA: false,
          challengeToken: null,
          error: null,
        });
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
