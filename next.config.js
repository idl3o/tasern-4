/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use static export only for Tauri builds
  ...(process.env.TAURI_BUILD === 'true' ? { output: 'export' } : {}),
  // Expose the build flavor to client code (e.g. wagmi ssr toggle)
  env: {
    NEXT_PUBLIC_TAURI_BUILD: process.env.TAURI_BUILD || '',
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
    return config;
  },
};

module.exports = nextConfig;
