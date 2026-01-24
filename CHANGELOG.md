# Changelog

All notable changes to this project will be documented in this file.

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
