/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

// Vitest config for the shared BizPilot business-logic tests (src/authz,
// src/context, src/data, src/lib, src/offline, src/selectors, src/utils,
// src/integrations). The mobile Vite build and its Ionic chunking were removed
// alongside the Ionic/Capacitor app; this file now only configures the test
// runner. Vitest transforms .tsx via esbuild, so @vitejs/plugin-react is not
// required here.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
