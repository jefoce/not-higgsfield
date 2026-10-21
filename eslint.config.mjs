import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/platform/desktop.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@tauri-apps/*"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-nested-ternary": "error",
      "react/jsx-no-leaked-render": ["error", { validStrategies: ["coerce"] }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/secrets/**", "src/core/presets/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^(OPENROUTER_(?!MOCK$)|R2_)/]",
          message: "Read secret values through src/server/secrets, not process.env.",
        },
        {
          selector:
            "Literal[value=/^(wan-3\\.0|wan-3\\.0-prime|seedance-2\\.0|seedance-2\\.5)$/]",
          message: "Preset ids live in src/core/presets. Import a preset instead.",
        },
        {
          selector: "Literal[value=/^(alibaba|bytedance)\\//]",
          message: "Preset slugs live in src/core/presets. Import a preset instead.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docs/**",
    // Generated desktop output and Rust/plist sources are not JS lint targets.
    "src-tauri/**",
    "src-tauri/target/**",
    "src-tauri/resources/**",
    "src-tauri/binaries/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
