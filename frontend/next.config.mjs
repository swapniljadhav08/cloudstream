/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The API is a separate service (docs/04_System_Architecture.md), reached
  // directly from the browser with a bearer token.
  env: {},
};

export default nextConfig;
