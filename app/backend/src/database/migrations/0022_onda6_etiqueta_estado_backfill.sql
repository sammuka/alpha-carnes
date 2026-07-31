-- Onda 6 — ciclo de estado da etiqueta (v1.1 §10.4).
-- Backfill determinístico e idempotente: só toca linhas ainda no default 'emitida'.
UPDATE "etiquetas_impressoes"
   SET "estado" = 'reimpressa'
 WHERE "estado" = 'emitida'
   AND "reimpressao" = true;
--> statement-breakpoint
UPDATE "etiquetas_impressoes"
   SET "estado" = 'ativa'
 WHERE "estado" = 'emitida'
   AND "reimpressao" = false
   AND "status_impressao" = 'impressa';
--> statement-breakpoint
DO $$
DECLARE fora_do_dominio integer;
BEGIN
  SELECT count(*) INTO fora_do_dominio
    FROM "etiquetas_impressoes"
   WHERE "estado" NOT IN ('emitida','ativa','invalidada_por_troca','reimpressa','cancelada');
  IF fora_do_dominio > 0 THEN
    RAISE EXCEPTION 'backfill incompleto: % etiqueta(s) fora do dominio v1.1 10.4', fora_do_dominio;
  END IF;
END $$;
