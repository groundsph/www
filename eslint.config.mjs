import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // eslint-config-next 16.3+ turns on the React Compiler rule set as
      // errors. This codebase predates it, and ~70 existing call sites trip
      // them (mostly setState inside effects used for prop sync, data loading
      // and timers). Adopting them is a refactor of its own, so they stay
      // visible as warnings instead of blocking every unrelated change.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
]);

export default eslintConfig;
