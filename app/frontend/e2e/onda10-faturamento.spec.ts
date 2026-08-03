import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { autenticarPagina } from './helpers/onda6-seed';
import { seedCaminhaoFechado } from './helpers/onda10-seed';

const EVIDENCIAS_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda10-faturamento');

function salvarEvidencia(): void {
  if (!fs.existsSync(EVIDENCIAS_DIR)) fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
}

/**
 * Onda 10 — jornada: pré-faturamento (emitir 1 nota unitária, SEM "emitir em
 * lote" — fora de escopo P-Onda10.3) → notas/XML (rastreabilidade, trava de
 * cancelamento pós-liberação) → seguro manual (pendente→enviado→confirmado)
 * → liberação (checklist incompleto→completo→liberar). Screenshots das 4
 * telas em docs/evidencias/onda10-faturamento/.
 */
test.describe('Onda 10 — Faturamento', () => {
  test('pre-faturamento, notas-xml, seguro-manual, liberacao', async ({ page, request }) => {
    test.setTimeout(180_000);
    salvarEvidencia();
    const cenario = await seedCaminhaoFechado(request);
    await page.goto('/login');
    await autenticarPagina(page, request);

    // ── Pré-Faturamento: badge de ambiente + emissão unitária ────────────
    await page.goto('/faturamento/pre-faturamento');
    await expect(page.getByRole('heading', { name: 'Pré-Faturamento' })).toBeVisible();
    await expect(page.getByText('Homologação EISS').or(page.getByText('Produção EISS'))).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(cenario.placa)).toBeVisible({ timeout: 15_000 });
    await page.getByText(cenario.placa).click();
    await expect(page.getByTestId('lista-pedidos')).toBeVisible({ timeout: 15_000 });

    const valorInput = page.locator('input[id^="valor-"]');
    await valorInput.first().fill('1500.00');
    await page.getByRole('button', { name: 'Emitir NFS-e' }).click();
    await expect(page.getByText(/emitida/i).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, 'app-pre-faturamento.png'), fullPage: true });

    // ── Notas/XML: rastreabilidade (drawer) ──────────────────────────────
    await page.goto('/faturamento/notas-xml');
    await expect(page.getByRole('heading', { name: 'Notas / XML' })).toBeVisible();
    await expect(page.getByTitle('Ver detalhe').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTitle('Ver detalhe').first().click();
    await expect(page.getByText('Vínculo pedido ↔ peças ↔ pesos ↔ item fiscal')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, 'app-notas-xml.png'), fullPage: true });

    // ── Seguro Manual: pendente → enviado → confirmado ───────────────────
    await page.goto('/faturamento/seguro-manual');
    await expect(page.getByRole('heading', { name: 'Seguro Manual' })).toBeVisible();
    // O registro do seguro nasce lazy — pode não existir ainda para este caminhão.
    // Cria via API para garantir estado determinístico antes de interagir com a UI.
    await request.post(`${process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4001'}/operacao/faturamento/seguros`, {
      headers: { Cookie: cenario.cookieHeader, 'Content-Type': 'application/json' },
      data: { caminhaoId: cenario.caminhaoId },
    });
    await page.reload();
    await expect(page.getByText(cenario.placa)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Marcar como enviado').first()).toBeVisible({ timeout: 15_000 });
    await page.getByText('Marcar como enviado').first().click();
    await expect(page.getByText('Marcar como confirmado').first()).toBeVisible({ timeout: 15_000 });
    await page.getByText('Marcar como confirmado').first().click();
    await expect(page.getByText('Seguro tratado').first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, 'app-seguro-manual.png'), fullPage: true });

    // ── Liberação: checklist completo → liberar ──────────────────────────
    // Completar faturamento (liberar-faturamento) para habilitar liberar-saida.
    await request.post(`${process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4001'}/operacao/expedicao/caminhoes/${cenario.caminhaoId}/liberar-faturamento`, {
      headers: { Cookie: cenario.cookieHeader, 'Content-Type': 'application/json' },
      data: {},
    });

    await page.goto('/faturamento/liberacao');
    await expect(page.getByRole('heading', { name: 'Liberação do Caminhão' })).toBeVisible();
    await expect(page.getByText(cenario.placa)).toBeVisible({ timeout: 15_000 });
    await page.getByText(cenario.placa).click();
    await expect(page.getByText('Requisitos para liberação')).toBeVisible({ timeout: 15_000 });
    const liberarBtn = page.getByRole('button', { name: 'Liberar Caminhão' });
    await expect(liberarBtn).toBeEnabled({ timeout: 15_000 });
    await liberarBtn.click();
    await expect(page.getByText('Já liberado')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(EVIDENCIAS_DIR, 'app-liberacao.png'), fullPage: true });

    // ── Trava de cancelamento pós-liberação (D10.4) ──────────────────────
    await page.goto('/faturamento/notas-xml');
    await expect(page.getByTitle('Caminhão já liberado — cancelamento bloqueado')).toBeVisible({ timeout: 15_000 });
  });
});
