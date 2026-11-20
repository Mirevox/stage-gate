import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables a minimal Node server bundle for Docker (`output: "standalone"`).
  output: "standalone",
};

export default nextConfig;
