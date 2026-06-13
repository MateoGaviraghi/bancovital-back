ALTER TABLE "reunion" ADD COLUMN "token" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "reunion" ADD COLUMN "asistencia_confirmada_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reunion" ADD CONSTRAINT "reunion_token_unique" UNIQUE("token");