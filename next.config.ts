import type { NextConfig } from "next";

// Keep the repository's manually maintained AGENTS.md unchanged during development.
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  agentRules: false,
  outputFileTracingIncludes: { "/api/v1/**": ["./src/server/agents/*.md"] },
};
export default config;
