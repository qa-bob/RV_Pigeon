import { defineConfig } from "@playwright/test";

/**
 * Config for the codegen/dry-run tooling used to build and debug the
 * Outdoorsy adapter (agent/src/adapters/outdoorsy.ts). Not used for CI test
 * runs — the adapter itself is validated via manual dry-run, per
 * Constitution Principle VI.
 */
export default defineConfig({
  timeout: 60_000,
  use: {
    headless: false,
    viewport: { width: 1280, height: 800 },
  },
});
