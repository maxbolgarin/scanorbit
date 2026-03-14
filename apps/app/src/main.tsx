import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { useThemeStore } from "@/stores/theme-store";
import "@fontsource/geist-sans";
import "@fontsource/geist-mono";
import "@/styles/globals.css";

// Apply theme immediately on load (before React renders) to prevent flash
const savedTheme = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem("scanorbit:theme") || "{}");
    return stored?.state?.theme || "dark";
  } catch {
    return "dark";
  }
})();

if (savedTheme === "dark" || (savedTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

// Hydrate the Zustand store so it applies listeners
useThemeStore.getState();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
