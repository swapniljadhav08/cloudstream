import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Self-contained server bundle, so the runtime image needs no node_modules.
  output: 'standalone',

  // The app lives in a workspace, so tracing has to start at the repo root or
  // the standalone build misses hoisted dependencies.
  outputFileTracingRoot: join(here, '..'),
};

export default nextConfig;
