/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Allows the app to be embedded in an <iframe> on lrrecords.com.au
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://lrrecords.com.au https://www.lrrecords.com.au",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
