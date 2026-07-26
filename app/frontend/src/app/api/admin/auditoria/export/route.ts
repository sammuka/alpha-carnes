import { NextRequest, NextResponse } from 'next/server';
import { fetchBackend } from '@/lib/api';

interface Registro {
  createdAt: string;
  usuarioNome: string | null;
  modulo: string | null;
  operacao: string;
  tabela: string;
  registroId: string;
  justificativa: string | null;
  ip: string | null;
}

interface Pagina {
  data: Registro[];
  total: number;
}

const LIMITE_PAGINAS = 50;

function celula(valor: string | null): string {
  return `"${(valor ?? '').replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const filtros = new URLSearchParams(request.nextUrl.searchParams);
  filtros.delete('page');
  filtros.set('pageSize', '100');

  const linhas: string[] = [
    'Data/Hora;Usuário;Módulo;Operação;Tabela;Registro;Justificativa;IP',
  ];
  let pagina = 1;
  let truncado = false;

  for (;;) {
    filtros.set('page', String(pagina));
    const { data, error } = await fetchBackend<Pagina>(`/auditoria?${filtros.toString()}`);
    if (error || !data) {
      return NextResponse.json({ message: error ?? 'Falha ao exportar auditoria' }, { status: 502 });
    }

    for (const registro of data.data) {
      linhas.push(
        [
          celula(new Date(registro.createdAt).toLocaleString('pt-BR')),
          celula(registro.usuarioNome),
          celula(registro.modulo),
          celula(registro.operacao),
          celula(registro.tabela),
          celula(registro.registroId),
          celula(registro.justificativa),
          celula(registro.ip),
        ].join(';'),
      );
    }

    if (pagina * 100 >= data.total) break;
    if (pagina >= LIMITE_PAGINAS) {
      truncado = true;
      break;
    }
    pagina += 1;
  }

  if (truncado) {
    linhas.push('# limite de 5000 registros atingido — refine o período');
  }

  return new NextResponse(`\uFEFF${linhas.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
      'X-Auditoria-Truncado': truncado ? '1' : '0',
    },
  });
}
