/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use static export only for Tauri builds
  ...(process.env.TAURI_BUILD === 'true' ? { output: 'export' } : {}),
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;
