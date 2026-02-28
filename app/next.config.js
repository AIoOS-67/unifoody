/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['pg', 'pg-pool', 'pg-connection-string', '@google-cloud/speech', '@google-cloud/text-to-speech', '@google-cloud/vertexai'],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        dns: false,
        net: false,
        tls: false,
        'pg-native': false,
      };
    }
    if (isServer) {
      config.externals.push('pg', 'pg-pool', 'pg-connection-string', 'pg-protocol', 'pg-types', 'pgpass');
    }
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    config.plugins.push(new webpack.IgnorePlugin({
      resourceRegExp: /HeartbeatWorker\.js$/,
      contextRegExp: /@coinbase\/wallet-sdk/,
    }));

    config.module.rules.push({
      test: /HeartbeatWorker\.js$/,
      use: 'null-loader'
    });

    return config;
  },
};

module.exports = nextConfig;
