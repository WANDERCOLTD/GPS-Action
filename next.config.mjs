/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hide the Next.js dev-mode indicator (the black "N" roundel in the
  // corner during `next dev`). It's noise during demo + design review.
  devIndicators: false,
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
