/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });

    // Configure watch options for development
    config.watchOptions = {
      poll: 1000, // revisa cambios cada segundo
      aggregateTimeout: 300,
    };

    return config;
  },
}

export default nextConfig
