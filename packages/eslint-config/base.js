import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import { globalIgnores } from "eslint/config"
import onlyWarn from "eslint-plugin-only-warn"
import turboPlugin from "eslint-plugin-turbo"
import tseslint from "typescript-eslint"

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    // Flat config only lints .js/.mjs/.cjs by default, so TypeScript has to be opted in
    files: ["**/*.{ts,tsx,mts,cts}"],
  },
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  globalIgnores(["dist/**", "generated/**"]),
]
