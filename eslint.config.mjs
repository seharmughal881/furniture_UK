import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Three Fiber mutates three.js objects (uniforms, materials, positions)
    // inside useFrame by design; the compiler's immutability rule can't model that.
    rules: { "react-hooks/immutability": "off" },
  },
  {
    // Product photos come from Shopify's CDN, which resizes them itself (see shopifyImage).
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Every other build directory this project produces. next.config.ts takes distDir
    // from NEXT_DIST_DIR, so `npm run build:preview` writes .next-preview and a one-off
    // build can write anything else -- and eslint would then lint the generated bundles,
    // reporting hundreds of errors in machine-written code. ".next/**" alone did not
    // cover them.
    ".next-*/**",
    "data/models/**",
  ]),
]);

export default eslintConfig;
