import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be accessed from the laptop's LAN IP
  // (e.g. when previewing from another device on the same network).
  allowedDevOrigins: ["192.168.1.2"],
};

export default nextConfig;
