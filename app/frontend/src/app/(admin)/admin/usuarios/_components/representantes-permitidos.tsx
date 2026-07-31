'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RepresentantePermitido } from '@/lib/usuarios';
import type { Representante } from '@/lib/representantes';

interface Props {
  selecionados: string[];
  vinculadosIniciais: RepresentantePermitido[];
  onChange: (ids: string[]) => void;
}

export function RepresentantesPermitidos({
  selecionados,
  vinculadosIniciais,
  onChange,
}: Props) {
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<Representante[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const carregarPagina = useCallback(async (pagina: number, termo: string, acumular: boolean) => {
    const params = new URLSearchParams({ page: String(pagina), pageSize: String(pageSize) });
    if (termo) params.set('search', termo);
    const res = await fetch(`/api/cadastros/representantes?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const corpo = (await res.json()) as { data: Representante[]; total: number };
    setTotal(corpo.total);
    setOpcoes((atuais) => (acumular ? [...atuais, ...corpo.data] : corpo.data));
  }, []);

  useEffect(() => {
    setPage(1);
    void carregarPagina(1, busca, false);
  }, [busca, carregarPagina]);

  const idsVinculados = useMemo(
    () => new Set(vinculadosIniciais.map((v) => v.id)),
    [vinculadosIniciais],
  );

  const opcoesVisiveis = useMemo(() => {
    const mapa = new Map<string, Representante | RepresentantePermitido>();
    for (const item of opcoes) mapa.set(item.id, item);
    for (const v of vinculadosIniciais) {
      if (!mapa.has(v.id)) mapa.set(v.id, v);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [opcoes, vinculadosIniciais]);

  const resumo = selecionados.length === 0
    ? 'Todos'
    : `${selecionados.length} selecionado(s)`;

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div>
        <Label className="text-sm font-semibold">Representantes permitidos</Label>
        <p className="text-xs text-muted-foreground">
          Sem seleção, o usuário acessa Todos os representantes
        </p>
        <p className="mt-1 text-xs font-medium text-foreground">{resumo}</p>
      </div>
      <Input
        placeholder="Buscar por nome"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {opcoesVisiveis.map((rep) => {
          const removido = 'deletedAt' in rep && rep.deletedAt !== null;
          const inativo = rep.status === 'inativo';
          const jaVinculado = idsVinculados.has(rep.id);
          const desabilitado = (removido || inativo) && !jaVinculado;
          const marcado = selecionados.includes(rep.id);
          return (
            <div key={rep.id} className="flex items-start gap-2">
              <Checkbox
                id={`rep-${rep.id}`}
                checked={marcado}
                disabled={desabilitado}
                onCheckedChange={(checked) => {
                  if (checked === true) onChange([...selecionados, rep.id]);
                  else onChange(selecionados.filter((id) => id !== rep.id));
                }}
              />
              <Label htmlFor={`rep-${rep.id}`} className="flex-1 text-sm font-normal">
                <span>{rep.nome}</span>
                {rep.tipoCanal && (
                  <span className="ml-1 text-muted-foreground">({rep.tipoCanal})</span>
                )}
                {(inativo || removido) && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {removido ? 'Removido' : 'Inativo'}
                  </Badge>
                )}
              </Label>
            </div>
          );
        })}
      </div>
      {opcoes.length < total && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const proxima = page + 1;
            setPage(proxima);
            void carregarPagina(proxima, busca, true);
          }}
        >
          Carregar mais
        </Button>
      )}
    </div>
  );
}
