<!--
Thanks for the PR! A few things to make review fast:

- Use a Conventional Commits title (e.g. `fix(api): handle missing AWS region`).
  See CONTRIBUTING.md for the full list.
- Keep the change focused — one logical change per PR.
- If you're touching security-relevant code, please call it out below.
-->

## What does this change?

<!-- One or two sentences. What is different after this PR is merged? -->

## Why?

<!-- The problem, motivation, or linked issue. -->

Closes #

## How was it tested?

<!--
- `make lint` / `make typecheck` / `make test` all pass locally
- Manual repro steps, before/after behaviour
- New tests added? Which ones?
-->

## Notes for reviewers

<!-- Anything subtle: schema migrations, env vars added, runtime behaviour changes, breaking API changes. -->

## Checklist

- [ ] Conventional Commits-style title
- [ ] `make lint` passes
- [ ] `make typecheck` passes
- [ ] `make test` passes
- [ ] Updated `.env.example` and README if a new env var was introduced
- [ ] Updated docs (`README.md`, `docs/`, or in-app help) if user-facing behaviour changed
