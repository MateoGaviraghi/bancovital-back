-- Post-migration SQL: RLS y triggers de inmutabilidad. Idempotente.
-- Se ejecuta DESPUES de las migrations Drizzle.

-- ============================================================================
-- audit_log: append-only. RLS habilitada. Solo admin lee todo; otros usuarios
-- leen solo sus propias filas. Nadie hace UPDATE/DELETE desde la app.
-- ============================================================================
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_admin_read ON audit_log;
CREATE POLICY audit_log_admin_read ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "user"
      WHERE "user".id = auth.uid()
        AND "user".role = 'admin'
    )
  );

DROP POLICY IF EXISTS audit_log_self_read ON audit_log;
CREATE POLICY audit_log_self_read ON audit_log
  FOR SELECT
  USING (actor_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies: la app inserta via service_role (bypassea
-- RLS). Sin policies para esos comandos, nadie con anon/authenticated puede
-- modificar o borrar audit_log.

-- ============================================================================
-- order_practice: snapshots inmutables. Una vez creado el row, los campos
-- snapshot (codigo NBU, nombre, units, ub_value, precios) no se pueden mutar.
-- Si la orden esta en borrador, se pueden borrar lineas y recrearlas, pero
-- nunca UPDATE-ar un snapshot existente.
-- ============================================================================
CREATE OR REPLACE FUNCTION order_practice_immutable_snapshots()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nbu_code_snapshot IS DISTINCT FROM OLD.nbu_code_snapshot
     OR NEW.name_snapshot IS DISTINCT FROM OLD.name_snapshot
     OR NEW.units_snapshot IS DISTINCT FROM OLD.units_snapshot
     OR NEW.ub_value_snapshot IS DISTINCT FROM OLD.ub_value_snapshot
     OR NEW.price_particular IS DISTINCT FROM OLD.price_particular
     OR NEW.price_insurer IS DISTINCT FROM OLD.price_insurer
     OR NEW.patient_copay IS DISTINCT FROM OLD.patient_copay
     OR NEW.practice_id IS DISTINCT FROM OLD.practice_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'order_practice snapshot columns are immutable (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_practice_immutable ON order_practice;
CREATE TRIGGER trg_order_practice_immutable
  BEFORE UPDATE ON order_practice
  FOR EACH ROW
  EXECUTE FUNCTION order_practice_immutable_snapshots();

-- ─── RLS en todas las tablas de public ───────────────────────────────────────
-- El front usa supabase-js SOLO para Auth y el backend se conecta como owner
-- (bypassa RLS), asi que habilitar RLS sin policies bloquea unicamente el
-- acceso directo via PostgREST con el anon key (que es publico en el bundle).
-- Idempotente.
ALTER TABLE public."attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."doctor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."insurer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."lab_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_practice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."result" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ub_value" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."laboratorio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."preferencia_pdf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."unidad_medida" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."practice_unidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."order_practice_unidad_value" ENABLE ROW LEVEL SECURITY;
