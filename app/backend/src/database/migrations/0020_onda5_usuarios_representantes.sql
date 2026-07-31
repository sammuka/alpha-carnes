CREATE TABLE "usuarios_representantes" (
	"usuario_id" uuid NOT NULL,
	"representante_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_usuarios_representantes" PRIMARY KEY("usuario_id","representante_id")
);
--> statement-breakpoint
ALTER TABLE "usuarios_representantes" ADD CONSTRAINT "usuarios_representantes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_representantes" ADD CONSTRAINT "usuarios_representantes_representante_id_representantes_id_fk" FOREIGN KEY ("representante_id") REFERENCES "public"."representantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usuarios_representantes_representante" ON "usuarios_representantes" USING btree ("representante_id");