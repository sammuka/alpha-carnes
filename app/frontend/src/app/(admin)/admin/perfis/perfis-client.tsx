'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
    <div className="flex h-full flex-col gap-5">
      {/* Cabeçalho — PerfisAcesso.tsx:139-143, literal */}
      <div>
        <p className="mb-0.5 text-[11px] font-medium text-text-muted">Administração / Perfis de Acesso</p>
        <h1 className="text-[20px] font-bold text-text-strong">Perfis de Acesso</h1>
        <p className="mt-0.5 text-[12px] text-text-secondary">
          Matriz de permissões por perfil e menus visíveis para cada perfil.
        </p>
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      {/* Matriz de permissões — PerfisAcesso.tsx:146-188: uma LINHA por perfil, uma COLUNA por permissão */}
      <Card className="overflow-hidden rounded-xl py-0">
        <div className="flex items-center gap-2 border-b border-muted px-4 py-3">
          <ShieldCheck className="size-4 text-action-blue" />
          <p className="text-[12px] font-bold text-text-strong">Matriz de permissões</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-muted bg-surface-subtle">
                <th
                  rowSpan={2}
                  className="sticky left-0 bg-surface-subtle px-4 py-2.5 text-left text-[10px] font-bold tracking-wider text-text-secondary uppercase whitespace-nowrap"
                >
                  Perfil
                </th>
                {(catalogo?.grupos ?? []).map((grupo) => (
                  <th
                    key={grupo.modulo}
                    colSpan={grupo.permissoes.length}
                    className="border-l border-muted px-3 py-2 text-center text-[10px] font-bold tracking-wider text-text-secondary uppercase whitespace-nowrap"
                  >
                    {grupo.modulo}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-muted bg-surface-subtle">
                {colunas.map((permissao) => (
                  <th
                    key={permissao.codigo}
                    title={permissao.descricao}
                    className="px-3 py-2.5 text-center text-[10px] font-bold tracking-wider text-text-secondary uppercase whitespace-nowrap"
                  >
                    {permissao.codigo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perfis.map((perfil, indice) => {
                const ativo = perfil.slug === slugSelecionado;
                return (
                  <tr
                    key={perfil.slug}
                    onClick={() => setSlugSelecionado(perfil.slug)}
                    className={`cursor-pointer border-b border-surface-subtle transition-colors ${
                      ativo
                        ? 'bg-action-blue-bg'
                        : indice % 2 !== 0
                          ? 'bg-table-zebra hover:bg-surface-subtle'
                          : 'hover:bg-surface-subtle'
                    }`}
                  >
                    <td
                      className={`sticky left-0 px-4 py-2.5 font-semibold whitespace-nowrap ${
                        ativo ? 'bg-action-blue-bg text-action-blue-hover' : 'bg-card text-text-strong'
                      }`}
                    >
                      {perfil.nome}
                    </td>
                    {colunas.map((permissao) => (
                      <td
                        key={permissao.codigo}
                        className="px-3 py-2.5 text-center"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <div className="flex justify-center">
                          <Switch
                            className="h-5 w-9"
                            aria-label={`${permissao.codigo} para ${perfil.nome}`}
                            checked={perfil.permissoes.includes(permissao.codigo)}
                            disabled={salvando}
                            onCheckedChange={() => void alternarPermissao(perfil, permissao.codigo)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Menus visíveis do perfil selecionado — PerfisAcesso.tsx:190-209, com D22.a */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl py-0">
        <div className="flex items-center justify-between border-b border-muted px-4 py-3">
          <p className="text-[12px] font-bold text-text-strong">
            Menus visíveis — {selecionado?.nome ?? 'selecione um perfil'}
          </p>
          <span className="text-[11px] text-text-muted">
            {selecionado
              ? `${selecionado.menusVisiveis.length} menu${selecionado.menusVisiveis.length !== 1 ? 's' : ''}`
              : '—'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selecionado ? (
            <p className="text-[13px] text-text-muted">Selecione um perfil na matriz.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {(catalogo?.menus ?? []).map((href) => {
                const marcado = selecionado.menusVisiveis.includes(href);
                return (
                  <button
                    key={href}
                    type="button"
                    aria-pressed={marcado}
                    disabled={salvando}
                    onClick={() => void alternarMenu(selecionado, href)}
                    className={`rounded-md border px-3 py-2 text-left text-[12px] transition-colors ${
                      marcado
                        ? 'border-action-blue bg-action-blue-bg text-action-blue-hover'
                        : 'border-muted bg-surface-subtle text-text-ink hover:border-action-blue'
                    }`}
                  >
                    {ROTULO_MENU.get(href) ?? href}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="flex items-start gap-2 border-t border-muted px-4 py-3 text-[11px] text-text-secondary">
          <Info className="mt-0.5 size-3.5 flex-shrink-0" />
          Alterar menus visíveis vale na próxima navegação do usuário. Alterar permissões de API vale no
          próximo login ou renovação de sessão.
        </p>
      </Card>
    </div>
  );
}
