import type { NextConfig } from "next";
// Preserve the repository owner's instruction that Markdown files remain unchanged.
const config: NextConfig = { agentRules: false };
export default config;
