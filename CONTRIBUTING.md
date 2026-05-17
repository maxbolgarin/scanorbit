# Contributing to ScanOrbit

Thanks for your interest in contributing. ScanOrbit is Apache 2.0 software maintained by a small group; we welcome bug reports, feature ideas, and patches.

## Ground rules

- **Be respectful and constructive** in issues, PRs, and reviews.
- **Security issues do not belong in public issues.** See [SECURITY.md](./SECURITY.md) for how to report them privately.
- **By submitting a contribution, you license it to the project under the Apache License 2.0** — the same license as the project (inbound = outbound). You confirm that you have the right to do so. No CLA is required.

## Reporting bugs

Open an issue using the **Bug report** template. The more reproducible the better — include the version (commit SHA or release tag), how you deployed (Docker Compose, native, etc.), relevant logs (`docker compose logs api`), and what you expected to see.

## Suggesting features

Open an issue using the **Feature request** template. Describe the problem you're trying to solve, not just the solution you have in mind. Small features may be picked up directly; larger ones are worth a short design discussion in the issue before code.

## Development setup

```bash
git clone https://github.com/maxbolgarin/scanorbit.git
cd scanorbit
cp .env.example .env

# Generate required secrets (any 32-byte hex value works)
for v in JWT_SECRET JWT_REFRESH_SECRET TOTP_ENCRYPTION_KEY OAUTH_ENCRYPTION_KEY; do
  sed -i.bak "s|^${v}=.*|${v}=$(openssl rand -hex 32)|" .env
done
rm -f .env.bak

make setup        # install deps, start db + redis, run migrations
make run          # native dev stack (api + app + scanner + analyzer)
```

`make help` lists every target. The full Docker stack is available via `make docker-run`.

### Layout

- `apps/api` — Hono.js backend (Node.js 24+, TypeScript strict)
- `apps/app` — React 19 frontend (Vite, Tailwind, Radix UI, Zustand, React Query)
- `apps/landing` — Astro static marketing site (deployed to GitHub Pages, not part of the Docker stack)
- `workers/` — Go services: `scanner` and `analyzer`
- `packages/` — shared TypeScript packages

### Before you submit a PR

```bash
make lint
make typecheck
make test
```

CI runs these on every PR.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/), and `semantic-release` derives version bumps from them:

| Type        | Effect                          |
| ----------- | ------------------------------- |
| `feat:`     | minor release                   |
| `fix:`      | patch release                   |
| `perf:`     | patch release                   |
| `docs:`     | patch release                   |
| `refactor:` | patch release                   |
| `revert:`   | patch release                   |
| `build:`    | patch release                   |
| `test:`     | no release                      |
| `style:`    | no release                      |
| `chore:`    | no release                      |
| `ci:`       | no release                      |
| `feat!:` / `BREAKING CHANGE:` | major release |

Example:

```
fix(api): handle missing AWS region in scan trigger

The trigger endpoint was returning 500 when the IAM role had no
default region. Fall back to AWS_REGION from config.

Fixes #123
```

Keep PRs focused: one logical change per PR is easier to review than a bundle.

## Pull request checklist

- [ ] Conventional Commit-style title
- [ ] Linked to an issue (if applicable)
- [ ] `make lint` passes
- [ ] `make typecheck` passes
- [ ] `make test` passes
- [ ] User-facing changes have a brief note in the PR description

## Code style

- TypeScript strict mode is on across the repo. New code must typecheck without `// @ts-ignore` or `any` workarounds unless absolutely necessary (and commented).
- ESLint config is shared from `packages/eslint-config`.
- Go code is formatted with `gofmt` and linted with `golangci-lint`.
- No new third-party services in the OSS build without a strong reason — ScanOrbit's value proposition includes "no external dependencies." If you do add one, make it optional (off by default) and document the env vars in `.env.example` and `README.md`.

## Tests

API tests use Vitest. They live in `apps/api/src/test/`. See [`CLAUDE.md`](./CLAUDE.md) and `apps/api/src/test/setup.ts` for established patterns (module mocking with `vi.hoisted`, Drizzle chain mocking via `helpers/mockDb`).

Go worker tests use the standard `testing` package; `cd workers && make test`.

## Questions

For anything that doesn't fit an issue or PR — design questions, "is this a bug or me?", roadmap thoughts — open a **Discussion** on GitHub.
