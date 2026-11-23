/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.tcgdex.net', port: '', pathname: '/**' },
      // photos of the actual cards, used when a listing has no catalogue artwork
      { protocol: 'https', hostname: 'htgchoxjicmmyyeeedag.supabase.co', port: '', pathname: '/storage/v1/object/public/card-photos/**' },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/images.pricecharting.com/**',
      },
      {
        protocol: 'https',
        hostname: 'images.pokemontcg.io',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
