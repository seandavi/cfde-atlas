import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle under `.next/standalone/` so
  // the production image can run without copying `node_modules`.
  // Required by the Dockerfile under `deploy/docker/`. The Cloudflare
  // build path (deploy/cloudflare/, OpenNext) does not use this.
  output: "standalone",
};

export default nextConfig;
