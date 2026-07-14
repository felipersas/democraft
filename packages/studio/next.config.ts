import type { NextConfig } from "next";

const REMOTION_EXTERNALS = [
  "@remotion/bundler",
  "@remotion/renderer",
  "@remotion/compositor",
  "@remotion/media-parser",
  "@remotion/renderer-client",
  "@remotion/renderer-server",
  "@rspack/core",
  "@rspack/binding",
  "esbuild",
  "webpack",
  "spawnr",
  "lightningcss",
  // Playwright is server-only and has native/browser deps that webpack
  // can't resolve. Used by the in-studio re-capture route.
  "playwright",
  "playwright-core",
  // These @democraft packages pull in playwright/compiler at runtime; keep
  // them external so the bundler doesn't try to trace into them.
  "@democraft/playwright",
  "@democraft/compiler",
  "@democraft/timeline",
];

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@democraft/remotion", "@democraft/schema"],
  serverExternalPackages: REMOTION_EXTERNALS,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  webpack: (webpackConfig, { isServer }) => {
    if (isServer) {
      const existing = Array.isArray(webpackConfig.externals)
        ? webpackConfig.externals
        : webpackConfig.externals
          ? [webpackConfig.externals]
          : [];
      webpackConfig.externals = [...existing, ...REMOTION_EXTERNALS];
      webpackConfig.module = webpackConfig.module ?? { rules: [] };
      webpackConfig.module.rules = [
        ...(webpackConfig.module.rules ?? []),
        { test: /\.node$/, type: "asset/source" },
      ];
    }
    return webpackConfig;
  },
};

export default config;
