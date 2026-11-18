/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gymos/shared-types', '@gymos/config', '@gymos/validation'],
};

export default nextConfig;
