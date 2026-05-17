// The OSS landing points all CTAs to the GitHub repo,
// where users find self-hosting instructions.
export const repoUrl = "https://github.com/maxbolgarin/scanorbit";

// Prefix a root-relative path with Astro's configured `base` so internal
// links and static assets resolve under deploys like GitHub Pages (`/scanorbit/`).
// Accepts and returns root-relative paths.
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return BASE + path;
}
