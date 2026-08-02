import { test, expect } from '@playwright/test';
import { autenticarPagina } from './helpers/onda6-seed';
import { seedCargaPronta } from './helpers/onda9-seed';

/**
 * Onda 9 — jornada: planejamento (rótulos do card/coluna) → conferência (bipagem
 * manual assistida + divergência + finalizar) → enviar-faturamento (banner roxo).
 * Rótulos do protótipo assertados nas 3 telas (D9.1/D9.4/D9.5/D9.7).
 */
test.describe('Onda 9 — carga', () => {
  test('planejamento, conferência por bipagem e envio a faturamento', async ({ page, request }) => {
    test.setTimeout(180_000);
    const cenario = await seedCargaPronta(request);
    await page.goto('/login');
    await autenticarPagina(page, request);

    // ── Planejamento ──────────────────────────────────────────────────────
    await page.goto('/carga/planejamento');
    await expect(page.getByRole('heading', { name: 'Planejamento de Expedição' })).toBeVisible();
    await expect(page.getByText('Pedidos do Dia (Sem Caminhão)')).toBeVisible();
    await expect(page.getByText('Caminhões Montados')).toBeVisible();
    await expect(page.getByText(cenario.placa)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Enviar para conferência')).toBeVisible();
    await page.getByText('Enviar para conferência').click();
    await expect(page.getByText('Em Conferência')).toBeVisible({ timeout: 15_000 });

    // ── Conferência por bipagem ───────────────────────────────────────────
    await page.goto('/carga/conferencia');
    await expect(page.getByText('Conferência de Carga')).toBeVisible();
    await expect(page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first().click();
    await expect(page.getByText(`Placa: ${cenario.placa}`)).toBeVisible();

    // Marcar divergência exige motivo obrigatório (ModalDivergencia).
    await page.getByRole('button', { name: 'Marcar divergência' }).click();
    await expect(page.getByText('Marcar divergência na peça')).toBeVisible();
    const confirmarDivergencia = page.getByRole('button', { name: 'Confirmar Divergência' });
    await expect(confirmarDivergencia).toBeDisabled();
    await page.getByText('Voltar').click();

    // Bipagem manual assistida: digitar a etiqueta + confirmar motivo via prompt.
    page.once('dialog', (dialog) => void dialog.accept('Leitura manual — leitor indisponível'));
    await page.getByPlaceholder(/Bipar etiqueta/i).fill(cenario.etiqueta);
    await page.getByRole('button', { name: 'Bipar' }).click();
    await expect(page.getByText(/conferida\./i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1 / 1 peças')).toBeVisible();

    const finalizar = page.getByRole('button', { name: 'Finalizar Conferência' });
    await expect(finalizar).toBeEnabled({ timeout: 10_000 });
    await finalizar.click();
    await expect(page.getByText('Carga conferida.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Enviar para Faturamento' })).toBeVisible();

    // ── Enviar para Faturamento ───────────────────────────────────────────
    await page.goto('/carga/enviar-faturamento');
    await expect(page.getByRole('heading', { name: 'Enviar para Faturamento' })).toBeVisible();
    await expect(page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(`Carga #${cenario.caminhaoId.slice(0, 8)}`).first().click();
    const botaoEnviar = page.getByRole('button', { name: 'Enviar para Faturamento' });
    await expect(botaoEnviar).toBeEnabled({ timeout: 10_000 });
    await botaoEnviar.click();
    await expect(page.getByText('Carga já enviada ao faturamento.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Histórico de Envios')).toBeVisible();
  });
});
