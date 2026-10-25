import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // AGENTS.md is maintained by hand; `next dev` would otherwise append to it.
  agentRules: false,
};

export default nextConfig;
