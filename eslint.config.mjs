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
  // Ban parent-relative imports in non-test code. The @/ alias covers
  // every source path; reach-up imports are a drift smell. Test files
  // under __tests__ keep relative imports for locality.
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: ["app/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Use the '@/' alias instead of parent-relative imports outside __tests__.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
