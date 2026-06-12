-- Prereq SQL: extensiones, sequence de protocolo y RLS de audit_log.
-- Idempotente: se puede correr multiples veces. Lo ejecuta setup.ts ANTES
-- de las migrations Drizzle (las tablas referencian seq_protocol y gin_trgm_ops).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE IF NOT EXISTS seq_protocol START 1;
