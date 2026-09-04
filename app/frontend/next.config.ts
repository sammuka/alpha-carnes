import type { NextConfig } from 'next';
import * as path from 'path';

/** cwd do `next` é `app/frontend`; `../..` é a raiz do monorepo (standalone / lockfile). */
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:4000'],
    },
  },
  async redirects() {
    return [
      { source: '/operacao/recebimento', destination: '/recebimento/recebimento-carga', permanent: false },
      { source: '/operacao/pesagem', destination: '/recebimento/pesagem-destinacao', permanent: false },
      { source: '/operacao/corte', destination: '/desossa/pesagem-destinacao', permanent: false },
      { source: '/operacao/expedicao', destination: '/carga/planejamento', permanent: false },
      { source: '/operacao/faturamento', destination: '/faturamento/pre-faturamento', permanent: false },
      { source: '/cadastros/clientes/:path*', destination: '/comercial/clientes', permanent: false },
      // AD-15: /cadastros/itens-compra e /cadastros/itens-comerciais retornam 404 (sem redirect).
    ];
  },
};

export default nextConfig;
