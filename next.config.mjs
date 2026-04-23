/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    // Fail build on type errors — no escape hatch
    ignoreBuildErrors: false,
  },
  eslint: {
    // Fail build on lint errors
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
