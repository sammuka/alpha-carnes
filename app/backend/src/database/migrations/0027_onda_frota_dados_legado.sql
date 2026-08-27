ALTER TABLE "frota_caminhoes" ADD COLUMN "fabricante" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "modelo" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "ano_fabricacao" integer;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "ano_modelo" integer;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "cor" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "chassi" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "certificado_numero" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "certificado_cidade" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "certificado_uf" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "certificado_data" date;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "numero_seguro" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "kilometragem" integer;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "tara_kg" integer;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "capacidade_m3" integer;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "veiculo_proprio" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "nome_proprietario" text;--> statement-breakpoint
ALTER TABLE "frota_caminhoes" ADD COLUMN "dimensoes_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "rg" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "carteira_profissional" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "nacionalidade" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "carteira_habilitacao" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "validade_habilitacao" date;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "emissao_habilitacao" date;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "data_primeira_habilitacao" date;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "celular" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "contato" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "tipo_vinculo" text;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "inicio_vinculo" date;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "endereco_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD COLUMN "fornecedor_legado_id" uuid;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD CONSTRAINT "frota_motoristas_fornecedor_legado_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_legado_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frota_motoristas" ADD CONSTRAINT "chk_frota_motoristas_tipo_vinculo" CHECK ("frota_motoristas"."tipo_vinculo" IS NULL OR "frota_motoristas"."tipo_vinculo" IN ('motorista','agregado','chapa'));