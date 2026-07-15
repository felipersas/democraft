import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "packages/*/dist/**",
      "node_modules/**",
      "coverage/**",
      ".turbo/**",
      "**/.next/**",
      "**/.source/**",
      "**/next-env.d.ts",
    ],
  },
);
