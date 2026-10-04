import { withAui } from "@assistant-ui/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["agentmail", "@onkernel/sdk", "ws"],
};

export default withAui(nextConfig);
