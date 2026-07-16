import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  typescript: {
    // typecheck runs as a separate turbo task
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    "fumadocs-ui",
    "fumadocs-core",
    "fumadocs-mdx",
  ],
};

export default withMDX(config);
