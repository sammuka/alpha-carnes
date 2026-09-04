'use client';

import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { toast } from 'sonner';
import { CadastroTabelaDrawer } from '@/components/cadastros/cadastro-tabela-drawer';
import { UF_OPTIONS, labelCodigoNome } from '@/lib/dominios';
import { mensagemDeErro } from '@/lib/error-message';
import type { Caminhao } from '@/lib/frota';
import { mascararPlaca } from '@/lib/masks';

interface RotaOpcao { id: string; codigo: string; nome: string; status: 'ativo' | 'inativo' }

export function CaminhoesClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [rotas, setRotas] = useState<RotaOpcao[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/rotas?page=1&pageSize=100&status=ativo', { cache: 'no-store' });
      if (!res.ok) {
        toast.error(await mensagemDeErro(res));
        return;
      }
      const dados = (await res.json()) as { data: RotaOpcao[] };
      setRotas(dados.data);
    })();
  }, []);

  return (
    <CadastroTabelaDrawer<Caminhao>
      titulo="Caminhões"
      subtitulo="Frota utilizada nas cargas e rotas de expedição."
      rotuloNovo="Novo Caminhão"
      rotuloSalvar="Salvar Caminhão"
      tituloDrawerNovo="Novo Caminhão"
      tituloDrawerEdicao={(c) => `Caminhão — ${c.placa}`}
      placeholderBusca="Buscar por placa ou descrição"
      substantivoSingular="caminhão"
      substantivoPlural="caminhões"
      endpoint="/api/cadastros/frota-caminhoes"
      larguraDrawer={520}
      podeGerenciar={podeGerenciar}
      mensagemVazia="Nenhum caminhão encontrado para os filtros aplicados."
      statusDe={(c) => c.status}
      filtros={[
        {
          nome: 'status',
          rotuloTodos: 'Status: Todos',
          opcoes: [
            { valor: 'ativo', rotulo: 'Ativo' },
            { valor: 'inativo', rotulo: 'Inativo' },
          ],
        },
      ]}
      colunas={[
        {
          chave: 'placa',
          titulo: 'Placa',
          tipo: 'mono',
          render: (c) => (
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-3" /> {c.placa}
            </span>
          ),
        },
        {
          chave: 'descricao',
          titulo: 'Descrição',
          render: (c) => <span className="text-foreground">{c.descricao ?? '—'}</span>,
        },
        {
          chave: 'veiculo',
          titulo: 'Fabricante / Modelo',
          render: (c) => (
            <span className="text-muted-foreground">
              {[c.fabricante, c.modelo].filter(Boolean).join(' ') || '—'}
              {c.anoFabricacao ? ` (${c.anoFabricacao})` : ''}
            </span>
          ),
        },
        {
          chave: 'capacidadeKg',
          titulo: 'Capacidade (kg)',
          tipo: 'numero',
          render: (c) => <>{c.capacidadeKg.toLocaleString('pt-BR')} kg</>,
        },
        {
          chave: 'rotaPadrao',
          titulo: 'Rota padrão',
          render: (c) => <span className="text-muted-foreground">{c.rotaPadraoNome ?? '—'}</span>,
        },
        {
          chave: 'veiculoProprio',
          titulo: 'Propriedade',
          render: (c) => (
            <span className="text-muted-foreground">{c.veiculoProprio ? 'Próprio' : 'Agregado'}</span>
          ),
        },
      ]}
      campos={[
        { nome: 'placa', rotulo: 'Placa', tipo: 'texto', obrigatorio: true, placeholder: 'ABC-1D23', monoespacado: true, mascara: mascararPlaca },
        { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', placeholder: 'Ex: Baú refrigerado — Mercedes 710', maxLength: 200 },
        { nome: 'capacidadeKg', rotulo: 'Capacidade (kg)', tipo: 'numero' },
        {
          nome: 'rotaPadraoId',
          rotulo: 'Rota padrão',
          tipo: 'combobox',
          placeholder: 'Sem rota padrão',
          opcoes: rotas.map((r) => ({
            valor: r.id,
            rotulo: `${labelCodigoNome(r.codigo, r.nome)}${r.status === 'ativo' ? '' : ' (inativo)'}`,
          })),
        },
        {
          nome: 'veiculoProprio',
          rotulo: 'Propriedade',
          tipo: 'select',
          opcoes: [
            { valor: 'true', rotulo: 'Próprio' },
            { valor: 'false', rotulo: 'Agregado' },
          ],
        },
        { nome: 'nomeProprietario', rotulo: 'Proprietário', tipo: 'texto', placeholder: 'Nome do proprietário (agregado)', maxLength: 200 },
        { nome: 'fabricante', rotulo: 'Fabricante', tipo: 'texto', placeholder: 'Ex: Volvo', maxLength: 100 },
        { nome: 'modelo', rotulo: 'Modelo', tipo: 'texto', placeholder: 'Ex: VM 260 6X2R', maxLength: 100 },
        { nome: 'anoFabricacao', rotulo: 'Ano de fabricação', tipo: 'numero' },
        { nome: 'anoModelo', rotulo: 'Ano do modelo', tipo: 'numero' },
        { nome: 'cor', rotulo: 'Cor', tipo: 'texto', maxLength: 50 },
        { nome: 'chassi', rotulo: 'Chassi', tipo: 'texto', monoespacado: true, maxLength: 50, mascara: (v) => v.toUpperCase() },
        { nome: 'certificadoNumero', rotulo: 'Certificado (número)', tipo: 'texto', monoespacado: true, maxLength: 50 },
        { nome: 'certificadoCidade', rotulo: 'Certificado (cidade)', tipo: 'texto', maxLength: 100 },
        {
          nome: 'certificadoUf',
          rotulo: 'Certificado (UF)',
          tipo: 'select',
          placeholder: '—',
          opcoes: UF_OPTIONS,
        },
        { nome: 'certificadoData', rotulo: 'Certificado (data)', tipo: 'data' },
        { nome: 'numeroSeguro', rotulo: 'Número do seguro', tipo: 'texto', maxLength: 50 },
        { nome: 'kilometragem', rotulo: 'Quilometragem', tipo: 'numero' },
        { nome: 'taraKg', rotulo: 'Tara (kg)', tipo: 'numero' },
        { nome: 'capacidadeM3', rotulo: 'Capacidade (m³)', tipo: 'numero' },
      ]}
      formularioVazio={{
        placa: '', descricao: '', capacidadeKg: '0', rotaPadraoId: '', status: 'ativo',
        veiculoProprio: 'true', nomeProprietario: '', fabricante: '', modelo: '',
        anoFabricacao: '', anoModelo: '', cor: '', chassi: '', certificadoNumero: '',
        certificadoCidade: '', certificadoUf: '', certificadoData: '', numeroSeguro: '',
        kilometragem: '', taraKg: '', capacidadeM3: '',
      }}
      paraFormulario={(c) => ({
        placa: c.placa,
        descricao: c.descricao ?? '',
        capacidadeKg: String(c.capacidadeKg),
        rotaPadraoId: c.rotaPadraoId ?? '',
        status: c.status,
        veiculoProprio: String(c.veiculoProprio),
        nomeProprietario: c.nomeProprietario ?? '',
        fabricante: c.fabricante ?? '',
        modelo: c.modelo ?? '',
        anoFabricacao: c.anoFabricacao != null ? String(c.anoFabricacao) : '',
        anoModelo: c.anoModelo != null ? String(c.anoModelo) : '',
        cor: c.cor ?? '',
        chassi: c.chassi ?? '',
        certificadoNumero: c.certificadoNumero ?? '',
        certificadoCidade: c.certificadoCidade ?? '',
        certificadoUf: c.certificadoUf ?? '',
        certificadoData: c.certificadoData ?? '',
        numeroSeguro: c.numeroSeguro ?? '',
        kilometragem: c.kilometragem != null ? String(c.kilometragem) : '',
        taraKg: c.taraKg != null ? String(c.taraKg) : '',
        capacidadeM3: c.capacidadeM3 != null ? String(c.capacidadeM3) : '',
      })}
      paraPayload={(f) => ({
        placa: (f.placa ?? '').trim().toUpperCase(),
        descricao: (f.descricao ?? '').trim() || undefined,
        capacidadeKg: (f.capacidadeKg ?? '').trim() || '0',
        rotaPadraoId: (f.rotaPadraoId ?? '').trim() || null,
        status: f.status,
        veiculoProprio: (f.veiculoProprio ?? 'true') === 'true',
        nomeProprietario: (f.nomeProprietario ?? '').trim() || undefined,
        fabricante: (f.fabricante ?? '').trim() || undefined,
        modelo: (f.modelo ?? '').trim() || undefined,
        anoFabricacao: (f.anoFabricacao ?? '').trim() || undefined,
        anoModelo: (f.anoModelo ?? '').trim() || undefined,
        cor: (f.cor ?? '').trim() || undefined,
        chassi: (f.chassi ?? '').trim() || undefined,
        certificadoNumero: (f.certificadoNumero ?? '').trim() || undefined,
        certificadoCidade: (f.certificadoCidade ?? '').trim() || undefined,
        certificadoUf: (f.certificadoUf ?? '').trim() || undefined,
        certificadoData: (f.certificadoData ?? '').trim() || undefined,
        numeroSeguro: (f.numeroSeguro ?? '').trim() || undefined,
        kilometragem: (f.kilometragem ?? '').trim() || undefined,
        taraKg: (f.taraKg ?? '').trim() || undefined,
        capacidadeM3: (f.capacidadeM3 ?? '').trim() || undefined,
      })}
    />
  );
}
