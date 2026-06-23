import type { NextConfig } from 'next';
import * as path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  async redirects() {
    return [
      { source: '/operacao/recebimento', destination: '/recebimento/recebimento-carga', permanent: false },
      { source: '/operacao/pesagem', destination: '/recebimento/pesagem-destinacao', permanent: false },
      { source: '/operacao/corte', destination: '/desossa/pesagem-destinacao', permanent: false },
      { source: '/operacao/expedicao', destination: '/carga/planejamento', permanent: false },
      { source: '/operacao/faturamento', destination: '/faturamento/pre-faturamento', permanent: false },
      { source: '/cadastros/itens-compra', destination: '/cadastros/produtos', permanent: false },
      { source: '/cadastros/itens-comerciais', destination: '/cadastros/produtos', permanent: false },
    ];
  },
};

export default nextConfig;
