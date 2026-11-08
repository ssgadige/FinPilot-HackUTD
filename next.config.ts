import type { NextConfig } from "next";

// Keep the repository's manually maintained AGENTS.md unchanged during development.
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  agentRules: false,
};
export default config;
