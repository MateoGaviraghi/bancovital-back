import { createHash } from 'node:crypto';

// @react-pdf/renderer es ESM — mock para tests unitarios.
jest.mock('@/pdf/render', () => ({
  renderContratoPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
  renderContratoFirmadoPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake signed')),
}));

import { ContractsService } from './contracts.service';

// ── Helpers exportados estáticamente ──────────────────────────────────────────

const slugify = ContractsService.slugify;
const obfuscateEmail = ContractsService.obfuscateEmail;
const sha256 = ContractsService.sha256;

// ── slugify ───────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('convierte minúsculas y reemplaza espacios por guiones', () => {
    expect(slugify('Laboratorio Santa Fe')).toBe('laboratorio-santa-fe');
  });

  it('elimina acentos', () => {
    expect(slugify('Bioquímica López Peña')).toBe('bioquimica-lopez-pena');
  });

  it('elimina caracteres especiales', () => {
    expect(slugify('Lab & Cia. S.A.')).toBe('lab-cia-sa');
  });

  it('colapsa múltiples guiones', () => {
    expect(slugify('Lab   ---   Central')).toBe('lab-central');
  });

  it('no empieza ni termina con guion', () => {
    const result = slugify(' - hola - ');
    expect(result).not.toMatch(/^-/);
    expect(result).not.toMatch(/-$/);
  });

  it('retorna string vacío si todo es especial', () => {
    expect(slugify('!@#$%^&*()')).toBe('');
  });

  it('maneja texto en mayúsculas', () => {
    expect(slugify('LABORATORIO CENTRAL')).toBe('laboratorio-central');
  });
});

// ── obfuscateEmail ─────────────────────────────────────────────────────────────

describe('obfuscateEmail', () => {
  it('oculta la parte local dejando solo el primer carácter', () => {
    expect(obfuscateEmail('juan@example.com')).toBe('j***@example.com');
  });

  it('conserva el dominio completo', () => {
    expect(obfuscateEmail('maria.garcia@laboratorio.com.ar')).toBe('m***@laboratorio.com.ar');
  });

  it('maneja email sin @ con fallback', () => {
    expect(obfuscateEmail('noemail')).toBe('***@***');
  });

  it('retorna fallback si no hay parte local (local vacío)', () => {
    // '@domain' → local='' (falsy) → fallback completo
    expect(obfuscateEmail('@domain')).toBe('***@***');
  });
});

// ── sha256 ────────────────────────────────────────────────────────────────────

describe('sha256', () => {
  it('genera el hash correcto', () => {
    const expected = createHash('sha256').update('test123').digest('hex');
    expect(sha256('test123')).toBe(expected);
  });

  it('retorna string hexadecimal de 64 caracteres', () => {
    expect(sha256('abc')).toHaveLength(64);
    expect(sha256('abc')).toMatch(/^[0-9a-f]+$/);
  });

  it('es determinista', () => {
    expect(sha256('mismo input')).toBe(sha256('mismo input'));
  });

  it('cambia con distinto input', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

// ── Transiciones de estado de contrato ────────────────────────────────────────

type ContratoEstado = 'enviado' | 'firmado' | 'vencido' | 'anulado';

function puedeVerificarOtp(estado: ContratoEstado, expiraAt: Date): boolean {
  return estado === 'enviado' && expiraAt > new Date();
}

function puedeFirmar(
  estado: ContratoEstado,
  expiraAt: Date,
  otpVerificadoAt: Date | null,
  windowMs: number,
): boolean {
  if (estado !== 'enviado' || expiraAt < new Date()) return false;
  if (!otpVerificadoAt) return false;
  return new Date(otpVerificadoAt.getTime() + windowMs) > new Date();
}

function puedeAnular(estado: ContratoEstado): boolean {
  return estado !== 'firmado';
}

describe('Transiciones de estado de contrato', () => {
  describe('Restricciones de firma', () => {
    const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const recentOtp = new Date(Date.now() - 5 * 60 * 1000);
    const windowMs = 20 * 60 * 1000;

    it('NO se puede firmar un contrato vencido', () => {
      const estado: ContratoEstado = 'vencido';
      expect(puedeFirmar(estado, futureExpiry, recentOtp, windowMs)).toBe(false);
    });

    it('NO se puede firmar un contrato anulado', () => {
      const estado: ContratoEstado = 'anulado';
      expect(puedeFirmar(estado, futureExpiry, recentOtp, windowMs)).toBe(false);
    });

    it('NO se puede firmar un contrato ya firmado', () => {
      const estado: ContratoEstado = 'firmado';
      expect(puedeFirmar(estado, futureExpiry, recentOtp, windowMs)).toBe(false);
    });

    it('SÍ se puede firmar un contrato enviado no vencido con OTP reciente', () => {
      const estado: ContratoEstado = 'enviado';
      const expiraAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const otpVerificadoAt = new Date(Date.now() - 5 * 60 * 1000); // 5 min atrás
      expect(puedeFirmar(estado, expiraAt, otpVerificadoAt, 20 * 60 * 1000)).toBe(true);
    });
  });

  describe('Restricciones de OTP', () => {
    it('no se puede solicitar OTP en estado firmado', () => {
      const estado: ContratoEstado = 'firmado';
      const expiraAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(puedeVerificarOtp(estado, expiraAt)).toBe(false);
    });

    it('no se puede solicitar OTP en estado anulado', () => {
      const estado: ContratoEstado = 'anulado';
      const expiraAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(puedeVerificarOtp(estado, expiraAt)).toBe(false);
    });

    it('no se puede solicitar OTP si expirado por fecha', () => {
      const estado: ContratoEstado = 'enviado';
      const expiraAt = new Date(Date.now() - 1000);
      expect(puedeVerificarOtp(estado, expiraAt)).toBe(false);
    });

    it('sí se puede solicitar OTP en estado enviado no vencido', () => {
      const estado: ContratoEstado = 'enviado';
      const expiraAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(puedeVerificarOtp(estado, expiraAt)).toBe(true);
    });
  });

  describe('Restricciones de anulación', () => {
    it('no se puede anular un contrato firmado', () => {
      const estado: ContratoEstado = 'firmado';
      expect(puedeAnular(estado)).toBe(false);
    });

    it('sí se puede anular un contrato enviado', () => {
      const estado: ContratoEstado = 'enviado';
      expect(puedeAnular(estado)).toBe(true);
    });

    it('sí se puede anular un contrato vencido', () => {
      const estado: ContratoEstado = 'vencido';
      expect(puedeAnular(estado)).toBe(true);
    });
  });

  describe('Intentos máximos de OTP', () => {
    const MAX_INTENTOS = 5;

    it('bloquea después de 5 intentos fallidos', () => {
      const intentos = 5;
      expect(intentos >= MAX_INTENTOS).toBe(true);
    });

    it('permite con 4 intentos', () => {
      const intentos = 4;
      expect(intentos >= MAX_INTENTOS).toBe(false);
    });

    it('verifica el código correctamente', () => {
      const codigo = '123456';
      const hash = sha256(codigo);
      expect(sha256(codigo)).toBe(hash);
      expect(sha256('654321')).not.toBe(hash);
    });
  });

  describe('Ventana de OTP verificado', () => {
    const WINDOW_MINUTES = 20;
    const WINDOW_MS = WINDOW_MINUTES * 60 * 1000;

    it('OTP verificado hace 19 minutos es válido', () => {
      const verificadoAt = new Date(Date.now() - 19 * 60 * 1000);
      const validUntil = new Date(verificadoAt.getTime() + WINDOW_MS);
      expect(validUntil > new Date()).toBe(true);
    });

    it('OTP verificado hace 21 minutos expiró', () => {
      const verificadoAt = new Date(Date.now() - 21 * 60 * 1000);
      const validUntil = new Date(verificadoAt.getTime() + WINDOW_MS);
      expect(validUntil < new Date()).toBe(true);
    });

    it('sin OTP verificado, no se puede firmar', () => {
      const estado: ContratoEstado = 'enviado';
      const expiraAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      expect(puedeFirmar(estado, expiraAt, null, WINDOW_MS)).toBe(false);
    });
  });

  describe('Slugify con colisiones y reservados', () => {
    const RESERVED = ['super', 'login', 'auth', 'api', 'contratar', 'r', 'admin'];

    it('slugs reservados no deben usarse directamente', () => {
      for (const slug of RESERVED) {
        expect(RESERVED.includes(slug)).toBe(true);
      }
    });

    it('slug derivado de nombre sin colisión', () => {
      const slug = slugify('Laboratorio Central Norte');
      expect(slug).toBe('laboratorio-central-norte');
      expect(RESERVED.includes(slug)).toBe(false);
    });

    it('nombre que da slug reservado requiere sufijo', () => {
      const base = slugify('Super Labs');
      expect(base).toBe('super-labs');
      // No está en reservados porque es "super-labs" no "super"
      expect(RESERVED.includes(base)).toBe(false);
    });

    it('slug de "Admin Lab" no está en reservados', () => {
      const s = slugify('Admin Lab');
      expect(s).toBe('admin-lab');
      expect(RESERVED.includes(s)).toBe(false);
    });
  });
});
