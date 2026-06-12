import { can, rolesFor } from './auth-policies';

describe('auth-policies.can', () => {
  it('admin puede todo', () => {
    expect(can('admin', 'patient.create')).toBe(true);
    expect(can('admin', 'order.cancel')).toBe(true);
    expect(can('admin', 'report.regenerate')).toBe(true);
    expect(can('admin', 'user.manage')).toBe(true);
    expect(can('admin', 'doctor.delete')).toBe(true);
  });

  it('recepcion y bioquimico tienen permisos operativos identicos', () => {
    for (const role of ['recepcion', 'bioquimico'] as const) {
      expect(can(role, 'patient.create')).toBe(true);
      expect(can(role, 'patient.update')).toBe(true);
      expect(can(role, 'doctor.create')).toBe(true);
      expect(can(role, 'doctor.update')).toBe(true);
      expect(can(role, 'order.create')).toBe(true);
      expect(can(role, 'order.confirm')).toBe(true);
      expect(can(role, 'order.finalize')).toBe(true);
      expect(can(role, 'result.upsert')).toBe(true);
      expect(can(role, 'report.emit')).toBe(true);
      // restricciones compartidas
      expect(can(role, 'order.cancel')).toBe(false);
      expect(can(role, 'doctor.delete')).toBe(false);
      expect(can(role, 'lab.update')).toBe(false);
      expect(can(role, 'user.manage')).toBe(false);
    }
  });

  it('rolesFor devuelve la lista para uso con @Roles()', () => {
    expect(rolesFor('order.cancel')).toEqual(['admin']);
    expect(rolesFor('patient.create')).toEqual(['admin', 'recepcion', 'bioquimico']);
    expect(rolesFor('report.emit')).toEqual(['admin', 'recepcion', 'bioquimico']);
  });
});
