import { pgEnum } from 'drizzle-orm/pg-core';

export const estadoLabEnum = pgEnum('estado_lab', ['activo', 'suspendido', 'inactivo']);

export const patientSexEnum = pgEnum('patient_sex', ['F', 'M', 'X']);

export const userRoleEnum = pgEnum('user_role', ['admin', 'recepcion', 'bioquimico', 'super']);

export const orderOriginEnum = pgEnum('order_origin', ['ambulatorio', 'internacion', 'urgencia']);

export const orderStatusEnum = pgEnum('order_status', [
  'borrador',
  'confirmada',
  'en_proceso',
  'resultados_cargados',
  'emitida',
  'entregada',
  'anulada',
]);

export const authorizationStatusEnum = pgEnum('authorization_status', [
  'no_aplica',
  'pendiente',
  'autorizada',
  'rechazada',
]);

export const resultFlagEnum = pgEnum('result_flag', [
  'normal',
  'low',
  'high',
  'critical_low',
  'critical_high',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'efectivo',
  'debito',
  'credito',
  'transferencia',
  'mp',
  'cuenta_corriente',
]);

export const attachmentKindEnum = pgEnum('attachment_kind', [
  'prescripcion',
  'autorizacion',
  'dni',
  'otros',
]);

export const suscripcionEstadoEnum = pgEnum('suscripcion_estado', ['activa', 'cancelada']);

export const movimientoTipoEnum = pgEnum('movimiento_tipo', ['cargo', 'pago']);

export const anuncioTipoEnum = pgEnum('anuncio_tipo', ['info', 'advertencia', 'mantenimiento']);

export const animalSexEnum = pgEnum('animal_sex', ['macho', 'hembra', 'indeterminado']);

export const reproductiveStatusEnum = pgEnum('reproductive_status', [
  'entero',
  'castrado',
  'esterilizado',
  'gestante',
  'lactante',
  'desconocido',
]);
