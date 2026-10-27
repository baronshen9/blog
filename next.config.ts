import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // AGENTS.md is maintained by hand; `next dev` would otherwise append to it.
  agentRules: false,
  // The project serves and tests at 127.0.0.1, which `next dev` treats as a
  // foreign origin beside `localhost`: it blocks the dev client's resources,
  // and pages it renders in the browser, such as not-found pages, stay blank.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
