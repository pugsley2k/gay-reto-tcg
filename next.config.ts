/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/images.pricecharting.com/**',
      },
      // You can add other domains here in the future if needed.
      // For example, if you also use Cloudinary for some images:
      // {
      //   protocol: 'https',
      //   hostname: 'res.cloudinary.com',
      // },
    ],
  },
};

module.exports = nextConfig;
