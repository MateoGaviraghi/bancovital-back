import { UnauthorizedException } from '@nestjs/common';
import { JwtVerifier, parseBearer } from './verify';

describe('parseBearer', () => {
  it('extrae el token de un Authorization header valido', () => {
    expect(parseBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('acepta "bearer" case-insensitive', () => {
    expect(parseBearer('bearer xyz')).toBe('xyz');
  });

  it('trimea whitespace alrededor del token', () => {
    expect(parseBearer('Bearer    token   ')).toBe('token');
  });

  it('lanza 401 si falta el header', () => {
    expect(() => parseBearer(undefined)).toThrow(UnauthorizedException);
    expect(() => parseBearer('')).toThrow(UnauthorizedException);
  });

  it('lanza 401 si el formato es invalido', () => {
    expect(() => parseBearer('Token abc')).toThrow(UnauthorizedException);
    expect(() => parseBearer('Bearer ')).toThrow(UnauthorizedException);
    expect(() => parseBearer('abc.def.ghi')).toThrow(UnauthorizedException);
  });
});

type MockGetUserResult = {
  data: {
    user: { id: string; email: string | null; app_metadata: Record<string, unknown> } | null;
  };
  error: { message: string } | null;
};

function makeVerifierWith(mock: jest.Mock<Promise<MockGetUserResult>, [string]>): JwtVerifier {
  const v = new JwtVerifier('https://example.supabase.co', 'anon-key', { cacheTtlMs: 60_000 });
  // Inyectamos el mock en el anon client privado.
  // biome-ignore lint/suspicious/noExplicitAny: test-only access to private field.
  (v as any).anonClient = { auth: { getUser: mock } };
  return v;
}

describe('JwtVerifier.verifyToken', () => {
  it('devuelve la Session con role del JWT app_metadata', async () => {
    const mock = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'u@example.com', app_metadata: { role: 'admin' } },
      },
      error: null,
    });
    const v = makeVerifierWith(mock);

    const session = await v.verifyToken('tok');

    expect(session).toEqual({ userId: 'user-1', email: 'u@example.com', role: 'admin' });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('lanza 401 si Supabase devuelve error', async () => {
    const mock = jest.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    });
    const v = makeVerifierWith(mock);

    await expect(v.verifyToken('tok')).rejects.toThrow(UnauthorizedException);
  });

  it('lanza 401 si el user no tiene role en app_metadata', async () => {
    const mock = jest.fn().mockResolvedValue({
      data: { user: { id: 'u', email: 'x@y.com', app_metadata: {} } },
      error: null,
    });
    const v = makeVerifierWith(mock);

    await expect(v.verifyToken('tok')).rejects.toThrow(UnauthorizedException);
  });

  it('lanza 401 si el role es un valor invalido', async () => {
    const mock = jest.fn().mockResolvedValue({
      data: { user: { id: 'u', email: 'x@y.com', app_metadata: { role: 'superuser' } } },
      error: null,
    });
    const v = makeVerifierWith(mock);

    await expect(v.verifyToken('tok')).rejects.toThrow(UnauthorizedException);
  });

  it('cachea: segunda llamada con mismo token NO consulta Supabase', async () => {
    const mock = jest.fn().mockResolvedValue({
      data: { user: { id: 'u', email: 'x@y.com', app_metadata: { role: 'recepcion' } } },
      error: null,
    });
    const v = makeVerifierWith(mock);

    const a = await v.verifyToken('tok');
    const b = await v.verifyToken('tok');

    expect(a).toEqual(b);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('expira el cache al pasar el TTL', async () => {
    const mock = jest.fn().mockResolvedValue({
      data: { user: { id: 'u', email: 'x@y.com', app_metadata: { role: 'bioquimico' } } },
      error: null,
    });
    const v = new JwtVerifier('https://example.supabase.co', 'anon', { cacheTtlMs: 10 });
    // biome-ignore lint/suspicious/noExplicitAny: test access.
    (v as any).anonClient = { auth: { getUser: mock } };

    await v.verifyToken('tok');
    await new Promise((r) => setTimeout(r, 20));
    await v.verifyToken('tok');

    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe('JwtVerifier.verifyAuthHeader', () => {
  it('integra parseBearer + verifyToken', async () => {
    const mock = jest.fn().mockResolvedValue({
      data: { user: { id: 'u', email: 'x@y.com', app_metadata: { role: 'admin' } } },
      error: null,
    });
    const v = makeVerifierWith(mock);

    const session = await v.verifyAuthHeader('Bearer real-token');

    expect(session.userId).toBe('u');
    expect(mock).toHaveBeenCalledWith('real-token');
  });

  it('lanza 401 si falta el header', async () => {
    const v = makeVerifierWith(jest.fn());
    await expect(v.verifyAuthHeader(undefined)).rejects.toThrow(UnauthorizedException);
  });
});
