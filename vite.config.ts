/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/lib/**/*.ts", "src/export/**/*.{ts,tsx}", "src/blocks.ts"],
      exclude: [
        "**/*.test.*",
        "src/lib/handleStore.ts",
        "src/lib/useCollabSync.ts",
        // DOM- and timing-bound React hook. Behavior is covered by
        // useYTextInput.test.tsx, but several branches (selectionStart null,
        // unmount-mid-observe, focus loss) don't repro cleanly in jsdom and
        // real validation is the two-window manual test.
        "src/lib/useYTextInput.ts",
      ],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 95,
      },
    },
  },
});
