'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileJson, Filter } from 'lucide-react';
import { toast } from 'sonner';
import type {
  FacetasAuditoria,
  FiltrosAuditoria,
  OperacaoAuditoria,
  PaginadoAuditoria,
  RegistroAuditoria,
} from '@/lib/auditoria';
import { mensagemDeErro } from '@/lib/error-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COR_OPERACAO: Record<OperacaoAuditoria, string> = {
  INSERT: 'bg-green-100 text-green-800',
  UPDATE: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-red-100 text-red-800',
  ACAO_MANUAL: 'bg-violet-100 text-violet-800',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AuditoriaAdminClient() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({ page: 1, pageSize: 20 });
  const [resultado, setResultado] = useState<PaginadoAuditoria | null>(null);
  const [selecionado, setSelecionado] = useState<RegistroAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [facetas, setFacetas] = useState<FacetasAuditoria | null>(null);
  const [registro, setRegistro] = useState('');
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
      const res = await fetch(`/api/admin/auditoria?${params.toString()}`);
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const data = (await res.json()) as PaginadoAuditoria;
      setResultado(data);
      setSelecionado((atual) => atual ?? data.data[0] ?? null);
    } catch {
      setErro('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/admin/auditoria/facetas', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      setFacetas((await res.json()) as FacetasAuditoria);
    })();
  }, []);

  const aplicarFiltros = () => {
    const valor = registro.trim();
    setFiltros((s) => ({
      ...s,
      registroId: UUID.test(valor) ? valor : undefined,
      registroBusca: valor && !UUID.test(valor) ? valor : undefined,
      page: 1,
    }));
  };

  const exportarCsv = async () => {
    setExportando(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && k !== 'page' && k !== 'pageSize') params.set(k, String(v));
      });
      const res = await fetch(`/api/admin/auditoria/export?${params.toString()}`);
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      if (res.headers.get('X-Auditoria-Truncado') === '1') {
        toast.warning('Exportação truncada em 5000 registros. Refine o período.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoria Filtrável</h1>
          <p className="text-sm text-muted-foreground">
            Rastreabilidade completa de alterações no sistema e segregação de funções
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={aplicarFiltros}>
            <Filter className="mr-2 h-4 w-4" />
            Aplicar Filtros
          </Button>
          <Button variant="outline" onClick={() => void exportarCsv()} disabled={exportando}>
            <Download className="mr-2 size-4" />
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label htmlFor="periodo-inicio">Período</Label>
            <div className="flex gap-2">
              <Input
                id="periodo-inicio"
                type="datetime-local"
                value={filtros.dataInicio ?? ''}
                onChange={(e) => setFiltros((s) => ({ ...s, dataInicio: e.target.value || undefined, page: 1 }))}
              />
              <Input
                aria-label="Período — fim"
                type="datetime-local"
                value={filtros.dataFim ?? ''}
                onChange={(e) => setFiltros((s) => ({ ...s, dataFim: e.target.value || undefined, page: 1 }))}
              />
            </div>
          </div>

          <div>
            <Label>Usuário</Label>
            <Select
              value={filtros.usuarioId ?? 'todos'}
              onValueChange={(v) =>
                setFiltros((s) => ({ ...s, usuarioId: v === 'todos' ? undefined : v, page: 1 }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os usuários</SelectItem>
                {(facetas?.usuarios ?? []).map((usuario) => (
                  <SelectItem key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Módulo</Label>
            <Select
              value={filtros.modulo ?? 'todos'}
              onValueChange={(v) =>
                setFiltros((s) => ({ ...s, modulo: v === 'todos' ? undefined : v, page: 1 }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(facetas?.modulos ?? []).map((modulo) => (
                  <SelectItem key={modulo} value={modulo}>
                    {modulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Operação</Label>
            <Select
              value={filtros.operacao ?? 'todas'}
              onValueChange={(v) =>
                setFiltros((s) => ({
                  ...s,
                  operacao: v === 'todas' ? undefined : (v as OperacaoAuditoria),
                  page: 1,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="INSERT">INSERT</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="ACAO_MANUAL">ACAO_MANUAL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="registro">Registro (ID)</Label>
            <Input
              id="registro"
              placeholder="UUID completo ou parte dele"
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="grid min-h-[420px] grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-8">
          <div className="max-h-[520px] overflow-auto p-5">
            {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!loading && resultado && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Data / Hora</th>
                    <th className="pb-3 font-medium">Usuário</th>
                    <th className="pb-3 font-medium">Módulo</th>
                    <th className="pb-3 font-medium">Operação</th>
                    <th className="pb-3 font-medium">Tabela / Registro</th>
                    <th className="pb-3 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {resultado.data.map((ev) => (
                    <tr
                      key={ev.id}
                      className={`cursor-pointer ${selecionado?.id === ev.id ? 'bg-muted/60' : 'hover:bg-muted/40'}`}
                      onClick={() => setSelecionado(ev)}
                    >
                      <td className="py-3 whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 text-muted-foreground">{ev.usuarioNome ?? 'Sistema'}</td>
                      <td className="py-3 text-muted-foreground">{ev.modulo ?? '—'}</td>
                      <td className="py-3">
                        <Badge className={COR_OPERACAO[ev.operacao]}>{ev.operacao}</Badge>
                      </td>
                      <td className="py-3">
                        <p className="text-xs text-muted-foreground">{ev.tabela}</p>
                        <p className="font-medium">{ev.registroId.slice(0, 8)}…</p>
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelecionado(ev)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {resultado && resultado.total > resultado.pageSize && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filtros.page ?? 1) <= 1}
                  onClick={() => setFiltros((s) => ({ ...s, page: (s.page ?? 1) - 1 }))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filtros.page ?? 1) * (filtros.pageSize ?? 20) >= resultado.total}
                  onClick={() => setFiltros((s) => ({ ...s, page: (s.page ?? 1) + 1 }))}
                >
                  Próxima
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden lg:col-span-4">
          <div className="border-b p-5">
            <div className="mb-2 flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Detalhe da Alteração</h2>
            </div>
            {selecionado?.justificativa && (
              <p className="text-sm text-muted-foreground">
                Justificativa: <span className="font-medium text-foreground">{selecionado.justificativa}</span>
              </p>
            )}
          </div>
          {selecionado ? (
            <div className="flex-1 overflow-auto bg-text-strong p-5 font-mono text-[12px] leading-relaxed text-border">
              <div className="mb-4">
                <p className="mb-1 text-text-muted">// Dados Anteriores</p>
                <pre className="overflow-x-auto rounded-[6px] border border-text-ink bg-code-surface p-3 text-destructive">
                  {JSON.stringify(selecionado.dadosAnteriores, null, 2)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-text-muted">// Dados Novos</p>
                <pre className="overflow-x-auto rounded-[6px] border border-text-ink bg-code-surface p-3 text-success">
                  {JSON.stringify(selecionado.dadosNovos, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">Selecione um evento.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
