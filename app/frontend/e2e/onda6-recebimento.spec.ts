import { test, expect } from '@playwright/test';
import {
  autenticarPagina,
  seedLoteParaConferencia,
} from './helpers/onda6-seed';

/**
 * Onda 6 — jornada das 3 rotas de recebimento (DoD 6.23 / 6.31).
 * 6.23 semeia o lote via API HTTP (sem E2E_ONDA6_SEED externo).
 */
test.describe('Onda 6 — recebimento', () => {
  test('percorre as 3 rotas de recebimento pelo menu', async ({ page, request }) => {
    await page.goto('/login');
    await autenticarPagina(page, request);
    await page.goto('/recebimento/recebimento-carga');
    await expect(page.getByRole('heading', { name: /Recebimento de carga/i })).toBeVisible();

    await page.goto('/recebimento/pesagem-destinacao');
    await expect(page.getByText(/Balança|Pesagem/i).first()).toBeVisible();

    await page.goto('/recebimento/etiquetas');
    await expect(page.getByRole('heading', { name: /Etiquetas/i })).toBeVisible();

    const erros: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') erros.push(msg.text());
    });
    await page.goto('/recebimento/recebimento-carga');
    await page.waitForTimeout(500);
    expect(erros.filter((e) => !/favicon|websocket/i.test(e))).toEqual([]);
  });

  test('captura itens da NF e conclui a conferência pela tela', async ({ page, request }) => {
    test.setTimeout(180_000);
    const { recebimentoId } = await seedLoteParaConferencia(request);

    await page.goto('/login');
    await autenticarPagina(page, request);

    await page.goto(`/recebimento/recebimento-carga?recebimentoId=${recebimentoId}`);
    await expect(page.getByTestId('receb-codigo')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('btn-capturar-itens-nf').click();
    await page.getByTestId('btn-concluir').click();
    await page.getByTestId('btn-confirmar-conferencia').click();
    await expect(page.getByText(/Conferido/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
