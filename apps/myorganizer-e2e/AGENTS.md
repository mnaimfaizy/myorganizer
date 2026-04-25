# E2E Agent Guide

## Scope

Playwright end-to-end tests for the MyOrganizer frontend.

## Commands

- Chromium: `yarn nx e2e myorganizer-e2e`.
- Interactive: `yarn nx e2e myorganizer-e2e --ui`.
- Cross-browser targets: `myorganizer-e2e:e2e-firefox`, `myorganizer-e2e:e2e-webkit`, `myorganizer-e2e:e2e-all`.

## Do

- Test critical user flows and use stable selectors or user-facing queries.
- Keep fixtures deterministic and avoid real third-party services.
- Add focused e2e coverage for meaningful route or workflow changes.

## Do Not

- Do not depend on live Google, email, or external APIs.
- Do not write brittle tests tied to incidental styling.
- Do not leave generated traces or screenshots committed unless intentionally added.
