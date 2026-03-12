# Changelog

All notable changes to this project will be documented in this file.

## [1.26.0](https://github.com/maxbolgarin/scanorbit/compare/v1.25.0...v1.26.0) (2026-03-12)

### Features

* **dashboard:** add finding type filters and hide trivial issues option to dashboard cards ([91f3174](https://github.com/maxbolgarin/scanorbit/commit/91f31748370e4e9d18c1789570e6f322b535f6ca))
* **dashboard:** add trigger scan button to no scan state component ([dff3ff2](https://github.com/maxbolgarin/scanorbit/commit/dff3ff2ae027e05e5745ce1113b9c5a933100545))
* **services:** add business analytics metrics for users, organizations, and aws accounts ([6b7b5be](https://github.com/maxbolgarin/scanorbit/commit/6b7b5bea8ea99265a234bcee516e33a7f9a063f9))
* **services:** add dateAttrib configuration to drip sequences and improve trial cleanup logic ([bf9926d](https://github.com/maxbolgarin/scanorbit/commit/bf9926d974ef8031ff38fb22ea3b7e8a02600cce))
* **services:** chain listmonk email operations and improve iam analyzer with resource filtering ([a86db3a](https://github.com/maxbolgarin/scanorbit/commit/a86db3a9de86a800e1df9c4b96a31781ad849c71))
* **services:** separate marketing consent from transactional onboarding and store newsletter preference as attribute ([2816e9d](https://github.com/maxbolgarin/scanorbit/commit/2816e9d424bbc4f45836397fee5662e792385d74))
* **services:** separate marketing consent from transactional onboarding emails and add newsletter unsubscribe secret ([49eee65](https://github.com/maxbolgarin/scanorbit/commit/49eee65e80cf72ed5b9c9c8701d354e1a283f1be))

### Bug Fixes

* **routes:** ensure date fields are properly converted to strings in csv exports ([1c395e7](https://github.com/maxbolgarin/scanorbit/commit/1c395e73f13220c53c9b5286aee6b2b4b5006691))

### Code Refactoring

* **deploy:** consolidate docker-compose production configuration and remove unused monitoring components ([588a508](https://github.com/maxbolgarin/scanorbit/commit/588a50817c6d0317be637e26b8b820935b47733f))

### Continuous Integration

* **.github:** add service deployment tracking and disable telegram notification sounds ([f77eafc](https://github.com/maxbolgarin/scanorbit/commit/f77eafc32baf322b3bae6e109e0000446086e39f))
* **.github:** compute and track deployed services in build workflow notifications ([5e91e37](https://github.com/maxbolgarin/scanorbit/commit/5e91e37c871cdbd5ae87e2b51a908618453ca685))
* **.github:** use head sha for pull request commits and add timezone import to telegram notifications ([47e0a4c](https://github.com/maxbolgarin/scanorbit/commit/47e0a4cfc14edb8367606ff419c7acaf4c667cfb))

## [1.25.0](https://github.com/maxbolgarin/scanorbit/compare/v1.24.0...v1.25.0) (2026-03-11)

### Features

* 8~y ([b7cadb9](https://github.com/maxbolgarin/scanorbit/commit/b7cadb91d20bc212fe0208d82b75d616976650d0))
* **billing:** add trial checkout flow and prevent plan switching on canceled subscriptions ([d1776f5](https://github.com/maxbolgarin/scanorbit/commit/d1776f542d8d0e95dc8d85efc8c694ee04ab516e))
* **db:** add processing_restricted flag to users table for gdpr compliance ([316c825](https://github.com/maxbolgarin/scanorbit/commit/316c8252f4510493575872cf0f5618f60c0c20f9))
* **services:** add listmonk email template configuration with drip campaign support ([f4a635f](https://github.com/maxbolgarin/scanorbit/commit/f4a635ffb730c075fca2d0156b06364fea64c80c))
* **services:** add sequential listmonk operations for gdpr deletion and trial/payment workflows ([f630876](https://github.com/maxbolgarin/scanorbit/commit/f6308768296e1d23b1c60757abe7d558ad564098))

### Bug Fixes

* **api:** ensure listmonk signup operations execute sequentially with proper error handling ([79423fb](https://github.com/maxbolgarin/scanorbit/commit/79423fbe63b9f0941da826716f57bcc823f8c96f))
* **auth:** add error handling for redis json parsing and prevent date serialization issues ([0a9cbd2](https://github.com/maxbolgarin/scanorbit/commit/0a9cbd2ec20b8dc95de4438e6d851c56d6e1ac15))
* **auth:** ensure oauth token expiry is properly converted to date object ([9b17bc1](https://github.com/maxbolgarin/scanorbit/commit/9b17bc1dac49a6b35c318fceb540f6f3158acfe0))
* **auth:** include organization creation timestamp in user profile response ([66286bf](https://github.com/maxbolgarin/scanorbit/commit/66286bfc50e2c94ec44670f82065a366ac4d8c73))
* **db:** use journal entry timestamps for migration tracking and remove stale drizzle schema ([ac0f561](https://github.com/maxbolgarin/scanorbit/commit/ac0f5615a5283443aa3d0ff99df23db3ef286b71))
* **gdpr:** add missing logger import for error handling ([8447434](https://github.com/maxbolgarin/scanorbit/commit/84474342d707fd073beace0d0628dc0e4b1d1f5c))
* **newsletter:** chain listmonk subscribe and sendImmediate to prevent race condition and improve healthcheck ([4bee259](https://github.com/maxbolgarin/scanorbit/commit/4bee2597de47d3b9138c5703e3b7a814f91ac439))
* **services:** use trial_end instead of current_period_end for subscription end date calculation ([66c2729](https://github.com/maxbolgarin/scanorbit/commit/66c27292ee73253b879ae9c5a7f8403ea13477e0))

### Code Refactoring

* **auth:** extract error handling utilities and add oauth token recovery mechanism ([8dc5be5](https://github.com/maxbolgarin/scanorbit/commit/8dc5be517689ffefa4f647756f0ef0fba7b4ab22))
* **db:** simplify migration tracking with maxEntries limit and improve applied migration detection ([19383ee](https://github.com/maxbolgarin/scanorbit/commit/19383eed18f5c7054c34cfd8d6391eb2bd4b5dd3))
* **listmonk-setup:** add type safety with interfaces and extract list fetching logic ([7a4dae3](https://github.com/maxbolgarin/scanorbit/commit/7a4dae3c9ffc3b609c3fc9bb2970bed6fba6141d))
* **services:** remove unused listmonk default list id configuration and simplify migration sync logic ([cc7b6ff](https://github.com/maxbolgarin/scanorbit/commit/cc7b6ffb87ae091e7e1991ca5b1a4e2b87991221))
* **services:** simplify listmonk subscriber lookup and improve query efficiency ([4c2314f](https://github.com/maxbolgarin/scanorbit/commit/4c2314ffd2f6a1f8def1eda6c7faf364eb7e514e))
* **settings:** improve password management ui with edit mode and update header navigation label ([3f613e2](https://github.com/maxbolgarin/scanorbit/commit/3f613e23760d7eb5ec22f4e08205ffbbd34df6e8))
* **settings:** reorganize settings pages and consolidate org/profile configuration with improved listmonk query handling ([e8d7dec](https://github.com/maxbolgarin/scanorbit/commit/e8d7decd405a8b5dca8ed1b377a400bd074589a7))

### Build System

* **deploy:** enhance production deployment with improved ssl configuration and database migration setup ([00be61d](https://github.com/maxbolgarin/scanorbit/commit/00be61d242f43c646158ed8e9b232bfb98e20a8c))
* **deploy:** migrate from promtail to alloy for log collection and update docker health checks to use localhost ip ([898fb55](https://github.com/maxbolgarin/scanorbit/commit/898fb5535bf5a3d1ae0fb539361e56828281b858))

### Continuous Integration

* **.github:** add listmonk-setup docker build workflow and expand deployment infrastructure ([994ee28](https://github.com/maxbolgarin/scanorbit/commit/994ee28e898c274d01b07bd33eaa7995d6c444ad))
* **.github:** add production deployment workflow to build and deploy changed services ([7a1368f](https://github.com/maxbolgarin/scanorbit/commit/7a1368f4897c16ddc0e8186f040b3e09316d7f99))
* **.github:** add telegram deployment notifications and enhance release workflow ([0af3269](https://github.com/maxbolgarin/scanorbit/commit/0af3269d9d9e08e0e24f57c3175a64669690dba5))
* **.github:** consolidate build workflows and add manual deployment inputs with environment and tag selection ([4c07957](https://github.com/maxbolgarin/scanorbit/commit/4c07957ad10ba87e30c596b5ca4cd24c6edea16b))

### Docs

* **email:** update listmonk list and template ids to reflect current configuration ([064809d](https://github.com/maxbolgarin/scanorbit/commit/064809d8b6fa4c7a3db031504d58ab138554cd32))

## [1.24.0](https://github.com/maxbolgarin/scanorbit/compare/v1.23.0...v1.24.0) (2026-03-10)

### Features

* 9~y ([5686f27](https://github.com/maxbolgarin/scanorbit/commit/5686f2795a8feaf7de759d7a8caf940c5b7701e0))
* **api:** add gdpr compliance with data retention cleanup, consent management, and automated job recovery ([f4f591c](https://github.com/maxbolgarin/scanorbit/commit/f4f591cecde820bda53dad38d3067e0d60e8a8da))
* **api:** add gdpr data export with billing and email marketing history ([a0bb62e](https://github.com/maxbolgarin/scanorbit/commit/a0bb62e169632351e78e331463b4276158155a9f))
* **api:** add gdpr right to restriction of processing with improved graceful shutdown and connection cleanup ([75a94eb](https://github.com/maxbolgarin/scanorbit/commit/75a94eb798721cd108fc888abeb694550d60bd9b))
* **api:** add request body size limit, improve webhook security, and enhance retention service with trusted proxy configuration ([7c6e552](https://github.com/maxbolgarin/scanorbit/commit/7c6e5525af969a25ea77f17e934c5c9a3a4e79e2))
* **api:** add totp replay attack prevention with redis-backed code tracking and improve two-factor authentication security ([4b1a945](https://github.com/maxbolgarin/scanorbit/commit/4b1a945029a9b08cca8b2ccba71e083dc18a2333))
* **api:** improve graceful shutdown with connection cleanup error handling and atomic redis lockout checks ([9814b2b](https://github.com/maxbolgarin/scanorbit/commit/9814b2be32ee1087a3dc4544e46ce7a3747d1c4e))
* **auth:** add oauth consent flow with redis-backed temporary token storage and rate limit improvements ([9ec32cc](https://github.com/maxbolgarin/scanorbit/commit/9ec32ccc6a36a9388c6f0cb118992ccc63ce1de4))
* **db:** add data deletion cascade handling and optimize scan/finding queries with indices ([f5574e3](https://github.com/maxbolgarin/scanorbit/commit/f5574e3948bfb52e7c73f9103283b5dec9dc705a))
* **jobs:** add stuck job recovery to retention cleanup with orphaned scan handling ([7330de6](https://github.com/maxbolgarin/scanorbit/commit/7330de676988957b30d190a2b22baf5eee737b8e))
* **landing:** add blog section with sitemap, robots.txt, and seo improvements ([1fa1495](https://github.com/maxbolgarin/scanorbit/commit/1fa1495617e9bb8d16f36744f4c73e0bf7332a8e))

### Bug Fixes

* **api:** use arrayBuffer for stripe webhook signature verification and add logging ([a0f832a](https://github.com/maxbolgarin/scanorbit/commit/a0f832ac714c30bc69f83b6f4e0bfecf03dedf23))

### Code Refactoring

* **api:** extract org id validation into reusable middleware to reduce duplication across routes ([fa30141](https://github.com/maxbolgarin/scanorbit/commit/fa301411f78f1cfedd682f7b96d515bf032a8804))
* **api:** modularize authentication service into specialized modules for oauth, password, and verification flows ([7d6509f](https://github.com/maxbolgarin/scanorbit/commit/7d6509f2715f511d0466063c6ad6352d6bca662a))
* **components/settings:** improve data privacy settings list styling and clarity ([8d8e329](https://github.com/maxbolgarin/scanorbit/commit/8d8e329447836bc6368f62bfe180f41f3e3d92cf))
* **components/settings:** remove unused icon imports from data privacy settings ([3578d82](https://github.com/maxbolgarin/scanorbit/commit/3578d823c77b4323fa02064082811bc5e144e71b))
* **workers:** add linter directives to suppress false positive security warnings ([68bef81](https://github.com/maxbolgarin/scanorbit/commit/68bef81642e0ef603b245eb2d4e305cea2db4c48))

### Tests

* **api:** add comprehensive test suite for authentication, services, and utilities with vitest ([2eb91e7](https://github.com/maxbolgarin/scanorbit/commit/2eb91e7927b02fb9bc0dd99dfbcae1e80888695b))
* **api:** add comprehensive test suite with vitest integration and mock helpers ([4f2051f](https://github.com/maxbolgarin/scanorbit/commit/4f2051f1c7d966438d6392afa9f132d8c6fd6219))
* **app:** add createdAt and updatedAt fields to aws account mock and update dependencies ([eae508f](https://github.com/maxbolgarin/scanorbit/commit/eae508fb8ab5458b80b4e28b09816bf0ff876911))
* **workers:** add comprehensive test suite for analyzers, models, scanner, and crypto packages ([66ae47b](https://github.com/maxbolgarin/scanorbit/commit/66ae47ba1cc3bca1fedc9aca6bf3a60dbcb17011))

### Build System

* **deploy:** restructure deployment documentation and scripts with automated database initialization and secrets management ([8ddb0de](https://github.com/maxbolgarin/scanorbit/commit/8ddb0de77d7e46ace44dff5f2c959fc7b176a7e7))
* **deploy:** restructure environment configuration with production deployment docs, entrypoint scripts, and secret management setup ([cb50f8a](https://github.com/maxbolgarin/scanorbit/commit/cb50f8a8cb32503a55f454860e3dfbc60d6bd4bb))

### Continuous Integration

* **.github/workflows:** update force-build workflow with default tag and disable all service builds by default ([3a2e5f6](https://github.com/maxbolgarin/scanorbit/commit/3a2e5f6627f9566517e91d0ee0506514a1e90d72))
* **.github:** add go test coverage tracking with race detection and summary reporting ([9f73183](https://github.com/maxbolgarin/scanorbit/commit/9f73183cd8bf074d629f20bbedc2ad9cfb56b0b1))
* **.github:** add pull request event types to build and lint workflows ([ed0db42](https://github.com/maxbolgarin/scanorbit/commit/ed0db4234a9ab4262b8b5aaf8333dcf08b1de167))
* **.github:** add semgrep sast security scanning with owasp and secrets detection rules ([e46873f](https://github.com/maxbolgarin/scanorbit/commit/e46873f8de2b57f909ba71153e019dee26aacea2))
* **.github:** remove semgrep security scanning workflow job and update golangci configuration ([6bc6a63](https://github.com/maxbolgarin/scanorbit/commit/6bc6a63dd2097d99a602e923a129e439568b9a17))
* rename workflows to build and lint, update branch targets to main ([0e15bdf](https://github.com/maxbolgarin/scanorbit/commit/0e15bdf4504700341fdac3dc52e060c925ce7417))
* **workers:** add golangci-lint integration and postgres service for go testing ([06cd2d3](https://github.com/maxbolgarin/scanorbit/commit/06cd2d367a5b08ecd05c161a92aecac595407ab7))
* **workers:** upgrade go version to 1.26.1 and golangci-lint to v2.11 ([962e243](https://github.com/maxbolgarin/scanorbit/commit/962e2438767612d0af84686ee8a9891d3323d2d9))

## [1.23.0](https://github.com/maxbolgarin/scanorbit/compare/v1.22.0...v1.23.0) (2026-03-07)

### Features

* **api:** add drip email campaign scheduler with listmonk integration and trial period reduction to 7 days ([cc319d8](https://github.com/maxbolgarin/scanorbit/commit/cc319d8dbf1df88b24b74e64244adeedf77e50c8))
* **api:** add email attribute tracking for user signup and trial events with listmonk integration ([f2d38b9](https://github.com/maxbolgarin/scanorbit/commit/f2d38b979296c7ba76a15ecabc4831280a101438))
* **api:** add listmonk campaign list configuration and automatic polling service ([8f62c25](https://github.com/maxbolgarin/scanorbit/commit/8f62c25d7ac9340aa576fd699b633ad9466a321a))
* **api:** add stripe subscription cancellation with email notifications and portal management ([fbf70cc](https://github.com/maxbolgarin/scanorbit/commit/fbf70cc1dbe807c8fd72503db662170a7250e5eb))

### Continuous Integration

* **.github/workflows:** add force-build workflow for manual docker image builds with selective service deployment ([1cdc9ee](https://github.com/maxbolgarin/scanorbit/commit/1cdc9ee642fa7fe3bde33cae4eb89e330d4ebd99))
* **.github/workflows:** make develop image tag configurable via repository variable ([a934f28](https://github.com/maxbolgarin/scanorbit/commit/a934f2889b292665e59fd7b98415451e7d2828a8))

### Docs

* **email:** add listmonk campaign setup guide with email templates and architecture ([48b50c1](https://github.com/maxbolgarin/scanorbit/commit/48b50c103674ef1580419b5e4106401341f92b90))
* **email:** update trial period from 14 to 7 days and add card requirement clarification ([9a7f200](https://github.com/maxbolgarin/scanorbit/commit/9a7f2009b09636311136b99a273de04a54a2a718))
* update trial period from 14 to 7 days and clarify automatic subscription renewal in email messaging ([316b344](https://github.com/maxbolgarin/scanorbit/commit/316b344c8b6f498179ca0b21e2365c143bb68b11))

## [1.22.0](https://github.com/maxbolgarin/scanorbit/compare/v1.21.0...v1.22.0) (2026-03-06)

### Features

* **landing:** restructure comparison and features sections with dependency graph focus and clarified value propositions ([48d42d2](https://github.com/maxbolgarin/scanorbit/commit/48d42d2db4cf7d6499b7d0e3d54e68ffa2adc42b))
* **terraform/scaleway:** add dns records for root, www, app, and api subdomains ([befdddf](https://github.com/maxbolgarin/scanorbit/commit/befdddf03fa7d74362e19061fa262656b2bae46a))

### Build System

* upgrade dependencies across api, app, and landing packages with pnpm lockfile consolidation ([b702b81](https://github.com/maxbolgarin/scanorbit/commit/b702b81900545b0fb625a079d9deedeb989e4b5f))

### Docs

* **marketing-plan:** restructure strategy with focus on solo developer advantages and async-first approach ([e860377](https://github.com/maxbolgarin/scanorbit/commit/e8603779913bc1d2b270b09749338230674f37a1))

## [1.21.0](https://github.com/maxbolgarin/scanorbit/compare/v1.20.0...v1.21.0) (2026-03-05)

### Features

* **deploy:** add maxbolgarin.com service with caddy reverse proxy and admin email configuration ([8188fbf](https://github.com/maxbolgarin/scanorbit/commit/8188fbf56039f31644103b148776c8c72c7bf26b))
* **newsletter:** add listmonk integration with subscription endpoints and landing page components ([bf82ce1](https://github.com/maxbolgarin/scanorbit/commit/bf82ce1b7c063ce3f3b06788f8e6e71167904129))

## [1.20.0](https://github.com/maxbolgarin/scanorbit/compare/v1.19.0...v1.20.0) (2026-01-25)

### Features

* **api:** add refresh token ttl buffer and error handling with verification logging ([56d246a](https://github.com/maxbolgarin/scanorbit/commit/56d246ab36bdd69c385e8a65b4c00b54baac4aaf))

## [1.19.0](https://github.com/maxbolgarin/scanorbit/compare/v1.18.0...v1.19.0) (2026-01-25)

### Features

* **api:** add concurrency handling to token refresh with subscriber pattern ([e17a9a3](https://github.com/maxbolgarin/scanorbit/commit/e17a9a392a254b1555ec680e6aa0f9e4c4eb7059))

## [1.18.0](https://github.com/maxbolgarin/scanorbit/compare/v1.17.1...v1.18.0) (2026-01-25)

### Features

* **auth:** make access token expiry configurable via environment variables ([c8887df](https://github.com/maxbolgarin/scanorbit/commit/c8887df1376c33bc6c5075ab5496925cd71180b7))

## [1.17.1](https://github.com/maxbolgarin/scanorbit/compare/v1.17.0...v1.17.1) (2026-01-25)

### Bug Fixes

* **securitysettings:** close password form div to fix layout structure ([cf5b3a1](https://github.com/maxbolgarin/scanorbit/commit/cf5b3a156ffcb27795df62fd47348ce2f80fb2cd))

## [1.17.0](https://github.com/maxbolgarin/scanorbit/compare/v1.16.0...v1.17.0) (2026-01-25)

### Features

* **api:** add resend email provider support with fallback to smtp and environment configuration ([0af9958](https://github.com/maxbolgarin/scanorbit/commit/0af9958ce0fdb519a85ddf19832dcda2cc2b30a0))

## [1.16.0](https://github.com/maxbolgarin/scanorbit/compare/v1.15.1...v1.16.0) (2026-01-25)

### Features

* **auth:** add browser-based logout endpoint with cookie-based session handling ([df0ea73](https://github.com/maxbolgarin/scanorbit/commit/df0ea73f7dea4f7edfc8789521db2f154a987073))

## [1.15.1](https://github.com/maxbolgarin/scanorbit/compare/v1.15.0...v1.15.1) (2026-01-25)

### Bug Fixes

* **auth:** use environment-aware sameSite cookie policy and clear auth state on logout ([be80953](https://github.com/maxbolgarin/scanorbit/commit/be80953608c8d00df89cebe59db5ee6a9df12b4b))

## [1.15.0](https://github.com/maxbolgarin/scanorbit/compare/v1.14.5...v1.15.0) (2026-01-25)

### Features

* **auth:** add password setup for oauth-only users and improve aws credentials documentation ([f37af49](https://github.com/maxbolgarin/scanorbit/commit/f37af495a0f975daa63d03cb4a321897ec59b6bc))

## [1.14.5](https://github.com/maxbolgarin/scanorbit/compare/v1.14.4...v1.14.5) (2026-01-24)

### Bug Fixes

* **app:** make OAuth callback route public to avoid auth race conditions ([b5adb2e](https://github.com/maxbolgarin/scanorbit/commit/b5adb2e3da7216bee735a374636e0c2ec70ccc6b))

## [1.14.4](https://github.com/maxbolgarin/scanorbit/compare/v1.14.3...v1.14.4) (2026-01-24)

### Bug Fixes

* **app:** add auth diagnostic logging and fix refreshAuth token handling ([85a7b3a](https://github.com/maxbolgarin/scanorbit/commit/85a7b3a4bf9509edd6a835b4f856bcc14bb7c080))

## [1.14.3](https://github.com/maxbolgarin/scanorbit/compare/v1.14.2...v1.14.3) (2026-01-24)

### Bug Fixes

* **app:** remove unused imports from RoleGuide.tsx ([9086ddf](https://github.com/maxbolgarin/scanorbit/commit/9086ddf90c896a508a936d20248055e01a9d51f2))

## [1.14.2](https://github.com/maxbolgarin/scanorbit/compare/v1.14.1...v1.14.2) (2026-01-24)

### Bug Fixes

* **app,auth:** preserve query params on unauthenticated redirect and add token refresh logging ([d5fedf8](https://github.com/maxbolgarin/scanorbit/commit/d5fedf8d11507edb512f4619a862c23e5a32b17d))

## [1.14.1](https://github.com/maxbolgarin/scanorbit/compare/v1.14.0...v1.14.1) (2026-01-24)

### Bug Fixes

* **auth,deploy:** update refresh token sameSite to 'None', add redis configuration and update oauth redirect paths ([a51a42f](https://github.com/maxbolgarin/scanorbit/commit/a51a42f6845cd0f99ffeea65ad60c79b14e15a65))

## [1.14.0](https://github.com/maxbolgarin/scanorbit/compare/v1.13.4...v1.14.0) (2026-01-24)

### Features

* **auth,config:** add cookie domain configuration for cross-subdomain oauth support ([72aeee9](https://github.com/maxbolgarin/scanorbit/commit/72aeee9bf7974042c3d160c1300cce243d4a3b48))

## [1.13.4](https://github.com/maxbolgarin/scanorbit/compare/v1.13.3...v1.13.4) (2026-01-23)

### Bug Fixes

* **auth:** update refresh token sameSite policy to 'None' for cross-origin requests ([da8255c](https://github.com/maxbolgarin/scanorbit/commit/da8255c4c1880a6cc5e35a34d38090386c38d2fc))

## [1.13.3](https://github.com/maxbolgarin/scanorbit/compare/v1.13.2...v1.13.3) (2026-01-23)

### Code Refactoring

* **app:** redesign ui components with responsive mobile-first layout and improved styling ([f4f222d](https://github.com/maxbolgarin/scanorbit/commit/f4f222d43209c7d650c674eeb6ff8c0c0e82a2ee))

## [1.13.2](https://github.com/maxbolgarin/scanorbit/compare/v1.13.1...v1.13.2) (2026-01-23)

### Bug Fixes

* **auth,api,app:** normalize frontend url, fix oauth cookie samesite and update monitoring setup ([a0917c9](https://github.com/maxbolgarin/scanorbit/commit/a0917c9da983b55488e0789a72b801fa7a36c216))

## [1.13.1](https://github.com/maxbolgarin/scanorbit/compare/v1.13.0...v1.13.1) (2026-01-23)

### Code Refactoring

* **deploy:** update Makefile for deployment, remove Docker commands, and enhance Terraform commands for production and test infrastructure ([1554355](https://github.com/maxbolgarin/scanorbit/commit/1554355a9ad0756c828d7861ba0b5fab35081efc))

## [1.13.0](https://github.com/maxbolgarin/scanorbit/compare/v1.12.0...v1.13.0) (2026-01-23)

### Features

* **api,db,auth,workers:** consolidate migrations, add encryption and rate limiting with trusted proxies support ([9cf67aa](https://github.com/maxbolgarin/scanorbit/commit/9cf67aa2debc2e671a5a1c185e7e1dc3a5d9c806))

## [1.12.0](https://github.com/maxbolgarin/scanorbit/compare/v1.11.0...v1.12.0) (2026-01-23)

### Features

* add metrics to app ([026a5f3](https://github.com/maxbolgarin/scanorbit/commit/026a5f3f9e585bfee4a4656a04b255b03afc783d))

## [1.11.0](https://github.com/maxbolgarin/scanorbit/compare/v1.10.0...v1.11.0) (2026-01-23)

### Features

* add plausible script to landing ([2a36ea4](https://github.com/maxbolgarin/scanorbit/commit/2a36ea4ab8f02c5266d9745fc1ffdfef794d4451))

### Continuous Integration

* add changes molnitor ([5c29f04](https://github.com/maxbolgarin/scanorbit/commit/5c29f04e786fbfb9fc6a0940626a3b9ee8f82811))

## [1.10.0](https://github.com/maxbolgarin/scanorbit/compare/v1.9.0...v1.10.0) (2026-01-22)

### Features

* **api,app,workers:** add job recovery, rate limiting with trusted proxies, and oauth token encryption ([386e44d](https://github.com/maxbolgarin/scanorbit/commit/386e44d1765933fcd366947e85a0bd62ada6b0d7))

## [1.9.0](https://github.com/maxbolgarin/scanorbit/compare/v1.8.1...v1.9.0) (2026-01-22)

### Features

* **api,app,db,workers:** add stripe integration with subscription tier management and enhanced resource analytics ([27777eb](https://github.com/maxbolgarin/scanorbit/commit/27777ebefae2bbd816d55a5511c7ad75d75c66d1))

## [1.8.1](https://github.com/maxbolgarin/scanorbit/compare/v1.8.0...v1.8.1) (2026-01-21)

### Code Refactoring

* **api,app,hooks:** remove unused imports and simplify audit logging ([11a03aa](https://github.com/maxbolgarin/scanorbit/commit/11a03aa2371c90b5a4a2f0c06035947c7b3ea1bc))

## [1.8.0](https://github.com/maxbolgarin/scanorbit/compare/v1.7.0...v1.8.0) (2026-01-21)

### Features

* **auth,app,api:** add two-factor authentication (2fa) with totp, subscription tiers, and enhanced security ([7c86b95](https://github.com/maxbolgarin/scanorbit/commit/7c86b95d6d964f1f659829472f814253933f1383))

## [1.7.0](https://github.com/maxbolgarin/scanorbit/compare/v1.6.0...v1.7.0) (2026-01-21)

### Features

* **auth,db,app:** add google and github oauth integration with enhanced authentication flow ([d9e1166](https://github.com/maxbolgarin/scanorbit/commit/d9e1166f29c64409e58908b892f41e18edee73eb))

## [1.6.0](https://github.com/maxbolgarin/scanorbit/compare/v1.5.0...v1.6.0) (2026-01-17)

### Features

* **db,api,app,workers:** add scanner enablement configuration and audit log optimization ([06136be](https://github.com/maxbolgarin/scanorbit/commit/06136be2cf466a3a1492ef8010f005b5d92a950b))

## [1.5.0](https://github.com/maxbolgarin/scanorbit/compare/v1.4.0...v1.5.0) (2026-01-17)

### Features

* **db,api,app:** add comprehensive resource dependency tracking, org settings, and enhanced dashboard with account-level views ([0cdeccf](https://github.com/maxbolgarin/scanorbit/commit/0cdeccf91782d78c7ac8181906e571a57b215b4d))

## [1.4.0](https://github.com/maxbolgarin/scanorbit/compare/v1.3.0...v1.4.0) (2026-01-15)

### Features

* **components:** add infrastructure map visualization with resource filtering and detailed resource views ([9e9c532](https://github.com/maxbolgarin/scanorbit/commit/9e9c5320f5152a96740cfd664d86653d827ac824))

## [1.3.0](https://github.com/maxbolgarin/scanorbit/compare/v1.2.0...v1.3.0) (2026-01-15)

### Features

* **resources:** add resource details view with raw data explorer and scan lifecycle management ([398d823](https://github.com/maxbolgarin/scanorbit/commit/398d823f27fbbaed2bcdb908a71868637185b21b))

## [1.2.0](https://github.com/maxbolgarin/scanorbit/compare/v1.1.6...v1.2.0) (2026-01-13)

### Features

* add Loki log aggregation with structured logging ([ba546f2](https://github.com/maxbolgarin/scanorbit/commit/ba546f2891020529a43d1644c83fb99f28b9f72e))
* add Prometheus metrics to all backend services ([e3f0cfc](https://github.com/maxbolgarin/scanorbit/commit/e3f0cfc82c15f613d46fbf5afa19366ed81a9243))
* add SSH tunnel commands for production monitoring access ([43c4bb2](https://github.com/maxbolgarin/scanorbit/commit/43c4bb2feace2e547039be9362df443bf071ce98))
* integrate metrics throughout backend services ([1daec17](https://github.com/maxbolgarin/scanorbit/commit/1daec172a11f2083c90315019b80dc34f6cd81b6))

### Bug Fixes

* logger import ([a79fe1a](https://github.com/maxbolgarin/scanorbit/commit/a79fe1a5e8a2501610b411ea888219e4fb39eecb))

## [1.1.6](https://github.com/maxbolgarin/scanorbit/compare/v1.1.5...v1.1.6) (2026-01-12)

### Bug Fixes

* improve database connection resilience and fix audit log route matching ([4162dff](https://github.com/maxbolgarin/scanorbit/commit/4162dff501c12ee721f7b7d571a3fc3cb869f062))

## [1.1.5](https://github.com/maxbolgarin/scanorbit/compare/v1.1.4...v1.1.5) (2026-01-11)

### Bug Fixes

* add AWS acc ID ([9477099](https://github.com/maxbolgarin/scanorbit/commit/947709947802af72ca6cac88e1ce493559666279))

## [1.1.4](https://github.com/maxbolgarin/scanorbit/compare/v1.1.3...v1.1.4) (2026-01-11)

### Bug Fixes

* final main fixes - general site is working ([c8785bb](https://github.com/maxbolgarin/scanorbit/commit/c8785bbb5fd7f6f36f9dbd774301502aca363b13))

## [1.1.3](https://github.com/maxbolgarin/scanorbit/compare/v1.1.2...v1.1.3) (2026-01-11)

### Bug Fixes

* CA certs ([b204b02](https://github.com/maxbolgarin/scanorbit/commit/b204b02838c531e0068b54f6bef9b1a02a25a73d))

## [1.1.2](https://github.com/maxbolgarin/scanorbit/compare/v1.1.1...v1.1.2) (2026-01-11)

### Bug Fixes

* more overall fixes ([dce1b51](https://github.com/maxbolgarin/scanorbit/commit/dce1b510ad39335db3838b6fb88d62a59fef1253))

## [1.1.1](https://github.com/maxbolgarin/scanorbit/compare/v1.1.0...v1.1.1) (2026-01-11)

### Bug Fixes

* many fixes ([7d9ac2c](https://github.com/maxbolgarin/scanorbit/commit/7d9ac2c4cc18ea9c3af1855e35093949b9cac9ac))

## [1.1.0](https://github.com/maxbolgarin/scanorbit/compare/v1.0.6...v1.1.0) (2026-01-11)

### Features

* all working with new deployment ([83bfe28](https://github.com/maxbolgarin/scanorbit/commit/83bfe28c796e40c9301ea184712b764c8db844f3))

## [1.0.6](https://github.com/maxbolgarin/scanorbit/compare/v1.0.5...v1.0.6) (2026-01-09)

### Bug Fixes

* url ([d7b935f](https://github.com/maxbolgarin/scanorbit/commit/d7b935f54e02b9ee3c09b6a500cac454075f93c1))

## [1.0.5](https://github.com/maxbolgarin/scanorbit/compare/v1.0.4...v1.0.5) (2026-01-09)

### Bug Fixes

* more ([b7010bb](https://github.com/maxbolgarin/scanorbit/commit/b7010bbd5a434bd0676c4d7bf18854ce70fdfc4d))

## [1.0.4](https://github.com/maxbolgarin/scanorbit/compare/v1.0.3...v1.0.4) (2026-01-09)

### Bug Fixes

* fixes ([4f77f4b](https://github.com/maxbolgarin/scanorbit/commit/4f77f4bb2a252876ded05149d33ce915bd016c0d))

### Continuous Integration

* make better ([a2c3e23](https://github.com/maxbolgarin/scanorbit/commit/a2c3e23bdc67c4f418e80fb798e8a8e4a6800a22))

## [1.0.3](https://github.com/maxbolgarin/scanorbit/compare/v1.0.2...v1.0.3) (2026-01-09)

### Bug Fixes

* ci 123 ([2d236b6](https://github.com/maxbolgarin/scanorbit/commit/2d236b6b4342d07ac52d64ea8f57b8250e0c444a))

## [1.0.2](https://github.com/maxbolgarin/scanorbit/compare/v1.0.1...v1.0.2) (2026-01-09)

### Bug Fixes

* ci ([6928716](https://github.com/maxbolgarin/scanorbit/commit/6928716936b659e648295db52016d08d975d9054))

## [1.0.1](https://github.com/maxbolgarin/scanorbit/compare/v1.0.0...v1.0.1) (2026-01-09)

### Bug Fixes

* linters ([2efe216](https://github.com/maxbolgarin/scanorbit/commit/2efe2163900b98f2e1be6dd4d5aedabd21c8b631))

### Build System

* updqt4e ci ([ca87819](https://github.com/maxbolgarin/scanorbit/commit/ca87819f3b866a1c00cc8685a5e7ac96046e7714))

### Continuous Integration

* fix ([1cc7739](https://github.com/maxbolgarin/scanorbit/commit/1cc7739e472321baf08d24c524ef0b9245faeb40))

## 1.0.0 (2026-01-09)

### Features

* add landing ([b375736](https://github.com/maxbolgarin/scanorbit/commit/b3757361e7a7cc317b0ec51fde22e5d838f68d66))
* add product ([a8dd661](https://github.com/maxbolgarin/scanorbit/commit/a8dd661b0140eb823a96ac157f54846dc023bfa9))
* add project layout ([5c3c9cc](https://github.com/maxbolgarin/scanorbit/commit/5c3c9cc9f61a3a02ca6ebbbdfacca37c555e6e9f))
* dev ([067bcb0](https://github.com/maxbolgarin/scanorbit/commit/067bcb06971e54820b4614a5d1f595a117475c07))
* landing is done ([869eba6](https://github.com/maxbolgarin/scanorbit/commit/869eba6bcfc0281e6b0d7669a5dc7f0cd371bd7d))
