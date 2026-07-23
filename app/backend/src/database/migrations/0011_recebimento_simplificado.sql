ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "nfe_numero" text;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "nfe_serie" text;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "nfe_chave" text;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "nfe_data_emissao" date;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "romaneio" text;--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "nfe_peso_bruto" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "nfe_peso_liquido" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "recebimentos" ADD COLUMN IF NOT EXISTS "nfe_volumes" numeric(15, 3);--> statement-breakpoint
UPDATE "recebimentos" SET "nfe_numero" = "nota_fiscal_fornecedor" WHERE "nfe_numero" IS NULL AND "nota_fiscal_fornecedor" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "recebimentos" DROP CONSTRAINT IF EXISTS "chk_recebimentos_status";--> statement-breakpoint
UPDATE "recebimentos" SET "status" = 'aguardando_conferencia' WHERE "status" = 'em_andamento';--> statement-breakpoint
UPDATE "recebimentos" SET "status" = 'em_conferencia' WHERE "status" = 'com_divergencia';--> statement-breakpoint
UPDATE "recebimentos" SET "status" = 'finalizado' WHERE "status" = 'concluido';--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "chk_recebimentos_status" CHECK ("recebimentos"."status" IN ('aguardando_conferencia','em_conferencia','finalizado','cancelado'));--> statement-breakpoint
ALTER TABLE "recebimentos" ALTER COLUMN "status" SET DEFAULT 'aguardando_conferencia';--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD COLUMN IF NOT EXISTS "origem_descricao" text;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD COLUMN IF NOT EXISTS "unidade_esperada" text;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD COLUMN IF NOT EXISTS "requer_balanca" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "recebimentos_itens" DROP CONSTRAINT IF EXISTS "chk_receb_itens_status_apuracao";--> statement-breakpoint
UPDATE "recebimentos_itens" SET "status_apuracao" = 'conferido' WHERE "status_apuracao" = 'conforme';--> statement-breakpoint
ALTER TABLE "recebimentos_itens" ADD CONSTRAINT "chk_receb_itens_status_apuracao" CHECK ("recebimentos_itens"."status_apuracao" IN ('aguardando','em_conferencia','conferido','divergente','entrada_direta'));
