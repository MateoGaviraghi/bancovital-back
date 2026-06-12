import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertUnidadValueDto } from './upsert-unidad-value.dto';

// Replica las opciones del ValidationPipe global (main.ts):
// transform + enableImplicitConversion.
async function parse(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpsertUnidadValueDto, plain, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return { dto, errors };
}

describe('UpsertUnidadValueDto', () => {
  it('acepta decimal con coma y lo normaliza a punto (bug Justitooo)', async () => {
    const { dto, errors } = await parse({ unidadId: 1, valueNumeric: '0,4' });
    expect(errors).toHaveLength(0);
    expect(dto.valueNumeric).toBe('0.4');
  });

  it('acepta decimal con punto sin alterarlo', async () => {
    const { dto, errors } = await parse({ unidadId: 1, valueNumeric: '98.5' });
    expect(errors).toHaveLength(0);
    expect(dto.valueNumeric).toBe('98.5');
  });

  it('acepta enteros', async () => {
    const { errors } = await parse({ unidadId: 1, valueNumeric: '5' });
    expect(errors).toHaveLength(0);
  });

  it('normaliza string vacio a undefined en vez de romper por regex', async () => {
    const { dto, errors } = await parse({
      unidadId: 1,
      valueNumeric: '',
      valueText: 'POSITIVO',
    });
    expect(errors).toHaveLength(0);
    expect(dto.valueNumeric).toBeUndefined();
    expect(dto.valueText).toBe('POSITIVO');
  });

  it('rechaza un valueNumeric realmente no numerico', async () => {
    const { errors } = await parse({ unidadId: 1, valueNumeric: 'abc' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('no toca las comas de valueText (texto libre)', async () => {
    const { dto, errors } = await parse({ unidadId: 1, valueText: 'Leve, turbio' });
    expect(errors).toHaveLength(0);
    expect(dto.valueText).toBe('Leve, turbio');
  });
});
