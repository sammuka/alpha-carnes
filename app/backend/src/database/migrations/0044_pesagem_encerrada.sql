ALTER TABLE "recebimentos" DROP CONSTRAINT "chk_recebimentos_status";
--> statement-breakpoint
UPDATE "recebimentos"
   SET "status" = 'pesagem_encerrada'
 WHERE "status" <> 'pesagem_em_andamento';
--> statement-breakpoint
ALTER TABLE "recebimentos" ADD CONSTRAINT "chk_recebimentos_status" CHECK ("recebimentos"."status" IN (
  'pesagem_em_andamento','pesagem_encerrada'
));
