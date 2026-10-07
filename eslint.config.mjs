import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", ".next-deploy/**", ".tools/**", "node_modules/**", "public/**", "deploy/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ["scripts/**/*.js"], rules: { "@typescript-eslint/no-require-imports": "off" } }
];

export default config;
