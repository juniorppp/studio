import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // Added for optimized Docker builds
  /* config options here */
  typescript: {
    ignoreBuildErrors: false, // Changed to false to catch build errors
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
