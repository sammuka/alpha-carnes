'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, FileJson, Filter } from 'lucide-react';
import type { FiltrosAuditoria, OperacaoAuditoria, PaginadoAuditoria, RegistroAuditoria } from '@/lib/auditoria';
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

export function AuditoriaAdminClient() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({ page: 1, pageSize: 20 });
  const [resultado, setResultado] = useState<PaginadoAuditoria | null>(null);
  const [selecionado, setSelecionado] = useState<RegistroAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        const data = await res.json().catch(() => ({}));
        setErro((data as { message?: string }).message ?? 'Falha ao carregar auditoria');
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoria Filtrável</h1>
          <p className="text-sm text-muted-foreground">
            Rastreabilidade completa de alterações no sistema e segregação de funções
          </p>
        </div>
        <Button onClick={() => void carregar()}>
          <Filter className="mr-2 h-4 w-4" />
          Aplicar Filtros
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label>Módulo</Label>
            <Input
              value={filtros.modulo ?? ''}
              onChange={(e) => setFiltros((s) => ({ ...s, modulo: e.target.value || undefined, page: 1 }))}
              placeholder="ex.: faturamento"
            />
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
            <Label>Tabela</Label>
            <Input
              value={filtros.tabela ?? ''}
              onChange={(e) => setFiltros((s) => ({ ...s, tabela: e.target.value || undefined, page: 1 }))}
            />
          </div>
          <div>
            <Label>Registro (UUID)</Label>
            <Input
              value={filtros.registroId ?? ''}
              onChange={(e) => setFiltros((s) => ({ ...s, registroId: e.target.value || undefined, page: 1 }))}
            />
          </div>
          <div>
            <Label>Usuário (UUID)</Label>
            <Input
              value={filtros.usuarioId ?? ''}
              onChange={(e) => setFiltros((s) => ({ ...s, usuarioId: e.target.value || undefined, page: 1 }))}
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
            <div className="flex-1 overflow-auto bg-slate-900 p-5 font-mono text-xs text-slate-200">
              <p className="mb-2 text-slate-400">// Dados Anteriores</p>
              <pre className="mb-4 overflow-x-auto rounded border border-slate-700 bg-slate-950 p-3 text-red-300">
                {JSON.stringify(selecionado.dadosAnteriores, null, 2)}
              </pre>
              <p className="mb-2 text-slate-400">// Dados Novos</p>
              <pre className="overflow-x-auto rounded border border-slate-700 bg-slate-950 p-3 text-green-300">
                {JSON.stringify(selecionado.dadosNovos, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">Selecione um evento.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
