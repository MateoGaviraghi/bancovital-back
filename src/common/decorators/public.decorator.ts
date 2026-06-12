import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un handler o controller como publico (skip AuthGuard global).
 * Solo se debe usar en endpoints intencionalmente no autenticados
 * (ej: /healthz). Es la unica via de exponer un endpoint sin autenticacion.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
