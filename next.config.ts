import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Activa o instrumentation.ts para correr migrations no arranque
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
