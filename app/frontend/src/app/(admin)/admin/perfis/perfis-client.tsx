'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { FilterChip } from '@/components/ui/filter-chip';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { mensagemDeErro } from '@/lib/error-message';
import { MENU_V2 } from '@/lib/menu-v2';

interface Perfil {
  id: string;
  slug: string;
  nome: string;
  permissoes: string[];
  menusVisiveis: string[];
}

interface Catalogo {
  grupos: Array<{ modulo: string; permissoes: Array<{ codigo: string; descricao: string }> }>;
  menus: string[];
}

const ROTULO_MENU = new Map(
  MENU_V2.flatMap((grupo) => grupo.items.map((item) => [item.href, `${grupo.title} · ${item.label}`])),
);

export function PerfisClient() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [slugSelecionado, setSlugSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [resPerfis, resCatalogo] = await Promise.all([
        fetch('/api/admin/perfis', { cache: 'no-store' }),
        fetch('/api/admin/perfis/catalogo', { cache: 'no-store' }),
      ]);
      if (!resPerfis.ok) {
        setErro(await mensagemDeErro(resPerfis));
        return;
      }
      if (!resCatalogo.ok) {
        setErro(await mensagemDeErro(resCatalogo));
        return;
      }
      const lista = (await resPerfis.json()) as Perfil[];
      setPerfis(lista);
      setCatalogo((await resCatalogo.json()) as Catalogo);
      setSlugSelecionado((atual) => atual ?? lista[0]?.slug ?? null);
    } catch {
      setErro('Erro de conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const selecionado = useMemo(
    () => perfis.find((p) => p.slug === slugSelecionado) ?? null,
    [perfis, slugSelecionado],
  );

  const colunas = useMemo(
    () => (catalogo?.grupos ?? []).flatMap((grupo) => grupo.permissoes),
    [catalogo],
  );

  const alternarPermissao = async (perfil: Perfil, codigo: string) => {
    const permissoes = perfil.permissoes.includes(codigo)
      ? perfil.permissoes.filter((c) => c !== codigo)
      : [...perfil.permissoes, codigo];
    await enviar(`/api/admin/perfis/${perfil.slug}/permissoes`, { permissoes });
  };

  const alternarMenu = async (perfil: Perfil, href: string) => {
    const menus = perfil.menusVisiveis.includes(href)
      ? perfil.menusVisiveis.filter((m) => m !== href)
      : [...perfil.menusVisiveis, href];
    await enviar(`/api/admin/perfis/${perfil.slug}/menus`, { menus });
  };

  const enviar = async (url: string, corpo: Record<string, string[]>) => {
    setSalvando(true);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      toast.success('Perfil atualizado.');
      await carregar();
    } catch {
      toast.error('Erro de conexão com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Perfis de Acesso" subtitle="Matriz de permissões por perfil e menus visíveis para cada perfil." />

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {/* Matriz de permissões — PerfisAcesso.tsx:146-188: uma LINHA por perfil, uma COLUNA por permissão */}
      <Card>
        <CardHeader>
          <ShieldCheck className="size-4 text-primary" />
          <CardTitle>Matriz de permissões</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-surface-2"
                >
                  Perfil
                </TableHead>
                {(catalogo?.grupos ?? []).map((grupo) => (
                  <TableHead
                    key={grupo.modulo}
                    colSpan={grupo.permissoes.length}
                    className="border-l border-border bg-surface-3 text-center text-[10px] font-bold uppercase tracking-[0.05em]"
                  >
                    {grupo.modulo}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow className="hover:bg-transparent">
                {colunas.map((permissao) => (
                  <TableHead
                    key={permissao.codigo}
                    title={permissao.descricao}
                    className="text-center"
                  >
                    {permissao.codigo}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perfis.map((perfil) => {
                const ativo = perfil.slug === slugSelecionado;
                return (
                  <TableRow
                    key={perfil.slug}
                    onClick={() => setSlugSelecionado(perfil.slug)}
                    data-state={ativo ? 'selected' : undefined}
                    className="cursor-pointer"
                  >
                    <TableCell
                      className={cn(
                        'sticky left-0 z-10 h-9 text-center font-semibold whitespace-nowrap',
                        ativo ? 'bg-primary-soft text-primary-fg' : 'bg-card text-foreground',
                      )}
                    >
                      {perfil.nome}
                    </TableCell>
                    {colunas.map((permissao) => (
                      <TableCell
                        key={permissao.codigo}
                        className="h-9 text-center"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <div className="flex justify-center">
                          <Switch
                            aria-label={`${permissao.codigo} para ${perfil.nome}`}
                            checked={perfil.permissoes.includes(permissao.codigo)}
                            disabled={salvando}
                            onCheckedChange={() => void alternarPermissao(perfil, permissao.codigo)}
                          />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Menus visíveis do perfil selecionado — PerfisAcesso.tsx:190-209, com D22.a */}
      <Card>
        <CardHeader>
          <CardTitle>
            Menus visíveis — {selecionado?.nome ?? 'selecione um perfil'}
          </CardTitle>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {selecionado
              ? `${selecionado.menusVisiveis.length} menu${selecionado.menusVisiveis.length !== 1 ? 's' : ''}`
              : '—'}
          </span>
        </CardHeader>

        <CardContent>
          {!selecionado ? (
            <p className="text-[13px] text-muted-foreground">Selecione um perfil na matriz.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(catalogo?.menus ?? []).map((href) => {
                const marcado = selecionado.menusVisiveis.includes(href);
                return (
                  <FilterChip
                    key={href}
                    active={marcado}
                    disabled={salvando}
                    onClick={() => void alternarMenu(selecionado, href)}
                    className="h-auto justify-start rounded-md px-3 py-2 text-left text-[12px]"
                  >
                    {ROTULO_MENU.get(href) ?? href}
                  </FilterChip>
                );
              })}
            </div>
          )}
        </CardContent>

        <CardFooter className="items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Alterar menus visíveis vale na próxima navegação do usuário. Alterar permissões de API vale no
          próximo login ou renovação de sessão.
        </CardFooter>
      </Card>
    </div>
  );
}
