import { can, rolesFor } from './auth-policies';

describe('auth-policies.can', () => {
  it('admin puede todo', () => {
    expect(can('admin', 'patient.create')).toBe(true);
    expect(can('admin', 'order.cancel')).toBe(true);
    expect(can('admin', 'report.regenerate')).toBe(true);
    expect(can('admin', 'user.manage')).toBe(true);
    expect(can('admin', 'doctor.delete')).toBe(true);
  });

  it('recepcion crea pacientes y ordenes pero NO cancela ni emite', () => {
    expect(can('recepcion', 'patient.create')).toBe(true);
    expect(can('recepcion', 'order.create')).toBe(true);
    expect(can('recepcion', 'order.confirm')).toBe(true);
    expect(can('recepcion', 'order.cancel')).toBe(false);
    expect(can('recepcion', 'result.upsert')).toBe(false);
    expect(can('recepcion', 'report.emit')).toBe(false);
    expect(can('recepcion', 'doctor.delete')).toBe(false);
  });

  it('bioquimico carga resultados y emite pero NO toca pacientes ni ordenes', () => {
    expect(can('bioquimico', 'result.upsert')).toBe(true);
    expect(can('bioquimico', 'report.emit')).toBe(true);
    expect(can('bioquimico', 'order.finalize')).toBe(true);
    expect(can('bioquimico', 'patient.create')).toBe(false);
    expect(can('bioquimico', 'order.create')).toBe(false);
    expect(can('bioquimico', 'order.cancel')).toBe(false);
    expect(can('bioquimico', 'lab.update')).toBe(false);
  });

  it('rolesFor devuelve la lista para uso con @Roles()', () => {
    expect(rolesFor('order.cancel')).toEqual(['admin']);
    expect(rolesFor('patient.create')).toEqual(['admin', 'recepcion']);
    expect(rolesFor('report.emit')).toEqual(['admin', 'bioquimico']);
  });
});
