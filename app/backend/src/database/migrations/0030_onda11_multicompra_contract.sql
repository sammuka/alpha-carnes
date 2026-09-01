ALTER TABLE "compras_programadas" ALTER COLUMN "numero_sequencial" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ALTER COLUMN "compra_programada_origem_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "associacoes_peca_historico" ALTER COLUMN "recebimento_origem_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_compras_prog_operacao_sequencial" ON "compras_programadas" USING btree ("operacao_id","numero_sequencial") WHERE "compras_programadas"."deleted_at" IS NULL AND "compras_programadas"."status" <> 'cancelada';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pecas_impedir_mutacao_compra_programada()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.compra_programada_id IS DISTINCT FROM OLD.compra_programada_id THEN
    RAISE EXCEPTION 'pecas.compra_programada_id is immutable (AD-14)';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_pecas_compra_programada_imutavel
  BEFORE UPDATE ON pecas
  FOR EACH ROW
  EXECUTE FUNCTION pecas_impedir_mutacao_compra_programada();
