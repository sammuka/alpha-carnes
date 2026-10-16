'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useRetornoFoco } from '../empresas/use-retorno-foco';
import { ListaDiferencas, type LinhaDiferenca } from './abas-fiscais';

export interface OpcaoVersao {
  id: string;
  rotulo: string;
}

interface Props {
  aberto: boolean;
  titulo: string;
  /** Versões do mesmo código (sem a atual), com número da versão e situação no rótulo. */
  carregarOpcoes: () => Promise<OpcaoVersao[]>;
  comparar: (outraId: string) => Promise<LinhaDiferenca[]>;
  onFechar: () => void;
}

const texto = (falha: unknown) => (falha instanceof Error ? falha.message : 'Falha na operação.');

/** Escolhe outra versão do mesmo código e lista as diferenças; erro e "sem diferenças" ficam dentro do diálogo. */
export function CompararVersoesDialog({ aberto, titulo, carregarOpcoes, comparar, onFechar }: Props) {
  const retornoFoco = useRetornoFoco(aberto);
  const [opcoes, setOpcoes] = useState<OpcaoVersao[] | null>(null);
  const [erroOpcoes, setErroOpcoes] = useState<string | null>(null);
  const [outra, setOutra] = useState('');
  const [diferencas, setDiferencas] = useState<LinhaDiferenca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [comparando, setComparando] = useState(false);
  const carregarRef = useRef(carregarOpcoes);
  carregarRef.current = carregarOpcoes;

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setOpcoes(null);
    setErroOpcoes(null);
    setOutra('');
    setDiferencas(null);
    setErro(null);
    carregarRef.current()
      .then((lista) => { if (ativo) setOpcoes(lista); })
      .catch((falha: unknown) => { if (ativo) setErroOpcoes(texto(falha)); });
    return () => { ativo = false; };
  }, [aberto]);

  async function executar() {
    if (!outra) {
      setErro('Escolha a outra versão.');
      return;
    }
    setComparando(true);
    setErro(null);
    try {
      setDiferencas(await comparar(outra));
    } catch (falha) {
      setDiferencas(null);
      setErro(texto(falha));
    } finally {
      setComparando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => { if (!a) onFechar(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={retornoFoco}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 px-4 pb-2 text-sm">
          {opcoes === null && !erroOpcoes && <Skeleton className="h-8" aria-label="Carregando versões" />}
          {erroOpcoes && <p role="alert" className="text-xs text-destructive">{erroOpcoes}</p>}
          {opcoes !== null && opcoes.length === 0 && (
            <p role="status" className="text-xs text-muted-foreground">Este código não tem outra versão para comparar.</p>
          )}
          {opcoes !== null && opcoes.length > 0 && (
            <label className="grid gap-1 text-xs">Outra versão
              <select
                aria-label="Outra versão"
                className="h-8 rounded-md border px-2"
                value={outra}
                onChange={(e) => { setOutra(e.target.value); setDiferencas(null); setErro(null); }}
              >
                <option value="">Selecione</option>
                {opcoes.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>)}
              </select>
            </label>
          )}
          {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
          {diferencas && <ListaDiferencas diferencas={diferencas} />}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onFechar}>Fechar</Button>
          <Button type="button" loading={comparando} disabled={opcoes === null || opcoes.length === 0} onClick={() => void executar()}>
            {titulo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
