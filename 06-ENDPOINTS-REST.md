# 06 — Endpoints REST

Todos los endpoints viven bajo el prefijo `/api`. Todos requieren `Authorization: Bearer <jwt>` excepto `/api/healthz`.

## Convención de respuestas

- Éxito: status 200/201 + JSON body
- 401 Unauthorized: sin token o inválido
- 403 Forbidden: rol no autorizado
- 404 Not Found: recurso no existe
- 409 Conflict: duplicado / transición inválida
- 422 Unprocessable Entity: DTO inválido (class-validator)
- 500 Internal Server Error: bug

Error body shape:
```json
{
  "statusCode": 404,
  "message": "Paciente no encontrado",
  "error": "Not Found"
}
```

## Endpoints

### Health

| Método | Path | Roles | Descripción |
|---|---|---|---|
| GET | `/api/healthz` | público | `{ok: true, time: ISO}` |

### Patients

| Método | Path | Roles | Body / Query | Descripción |
|---|---|---|---|---|
| GET | `/api/patients` | todos | `?q=&limit=` | Buscar pacientes |
| GET | `/api/patients/:id` | todos | | Por ID |
| POST | `/api/patients` | admin, recepcion | CreatePatientDto | Crear |
| PATCH | `/api/patients/:id` | admin, recepcion | UpdatePatientDto | Actualizar |

### Doctors

| Método | Path | Roles | Body / Query | Descripción |
|---|---|---|---|---|
| GET | `/api/doctors` | todos | `?q=&limit=` | Buscar / listar |
| GET | `/api/doctors/:id` | todos | | Por ID |
| POST | `/api/doctors` | admin, recepcion | CreateDoctorDto | Crear |
| PATCH | `/api/doctors/:id` | admin, recepcion | UpdateDoctorDto | Actualizar |
| DELETE | `/api/doctors/:id` | admin | | Soft delete |

### Insurers (Obras sociales)

| Método | Path | Roles | Body / Query | Descripción |
|---|---|---|---|---|
| GET | `/api/insurers` | todos | `?onlyActive=true` | Listar |
| GET | `/api/insurers/with-ub` | todos | | Con UB vigente |
| GET | `/api/insurers/:id` | todos | | Por ID |
| GET | `/api/insurers/:id/ub-history` | todos | | Historial de UBs |
| POST | `/api/insurers` | admin | CreateInsurerDto | Crear |
| PATCH | `/api/insurers/:id` | admin | UpdateInsurerDto | Actualizar |
| PATCH | `/api/insurers/:id/active` | admin | `{active: bool}` | Activar/desactivar |

### UB Values

| Método | Path | Roles | Body | Descripción |
|---|---|---|---|---|
| POST | `/api/ub-values` | admin | `{insurerId, value, validFrom, notes?}` | Abrir nuevo período (cierra el anterior) |

### Practices

| Método | Path | Roles | Body / Query | Descripción |
|---|---|---|---|---|
| GET | `/api/practices` | todos | `?q=&limit=&section=` | Buscar |
| GET | `/api/practices/bulk` | todos | `?ids=1,2,3` | Por IDs |

### Orders

| Método | Path | Roles | Body / Query | Descripción |
|---|---|---|---|---|
| GET | `/api/orders` | todos | `?status[]=&insurerId=&dateFrom=&dateTo=&search=&limit=` | Listar con filtros |
| GET | `/api/orders/:id` | todos | | Detalle |
| GET | `/api/orders/:id/lines` | todos | | Líneas (snapshots) |
| POST | `/api/orders` | admin, recepcion | CreateOrderDto | Crear borrador (transacción) |
| PATCH | `/api/orders/:id/confirm` | admin, recepcion | | borrador → confirmada |
| PATCH | `/api/orders/:id/cancel` | admin | `{reason?: string}` | → anulada |
| PATCH | `/api/orders/:id/finalize` | admin, bioquimico | | resultados_cargados |

### Results

| Método | Path | Roles | Body | Descripción |
|---|---|---|---|---|
| GET | `/api/orders/:orderId/results` | todos | | Hidratado con metadata + rangos |
| POST | `/api/results` | admin, bioquimico | UpsertResultDto | Upsert + calcula flag |

### Reports

| Método | Path | Roles | Body / Query | Descripción |
|---|---|---|---|---|
| POST | `/api/reports/:orderId/emit` | admin, bioquimico | | Render + sign + upload PDF, marca emitida |
| GET | `/api/reports/:orderId/signed-url` | admin, bioquimico | `?ttlSeconds=900` | URL firmada (self-healing) |
| POST | `/api/reports/regenerate-all` | admin | | Regenera todos los PDFs de órdenes emitidas |

### Lab Config

| Método | Path | Roles | Body | Descripción |
|---|---|---|---|---|
| GET | `/api/lab-config` | todos | | Singleton |
| PATCH | `/api/lab-config` | admin | UpdateLabConfigDto | Actualizar |

### Users (admin only)

| Método | Path | Roles | Body | Descripción |
|---|---|---|---|---|
| GET | `/api/users` | admin | | Listar todos |
| POST | `/api/users/invite` | admin | InviteUserDto | Enviar invitación |
| PATCH | `/api/users/:id/role` | admin | `{role}` | Cambiar rol |
| PATCH | `/api/users/:id/active` | admin | `{active}` | Activar/desactivar |

## Ejemplos de request/response

### POST `/api/orders` (crear borrador)

Request:
```json
{
  "patientId": 12,
  "insurerId": 3,
  "insurerCode": "IAPOS",
  "practiceIds": [101, 205, 310],
  "isUrgent": false,
  "origin": "ambulatorio",
  "referringDoctorId": 5,
  "diagnosis": "Control rutinario"
}
```

Response 201:
```json
{
  "id": 42,
  "protocolNumber": 11,
  "status": "borrador",
  "totalParticular": "12450.00",
  "totalInsurer": "8400.00",
  "totalPatientCopay": "0.00",
  "lineCount": 5
}
```

### GET `/api/orders/42/results`

Response 200:
```json
{
  "lines": [
    {
      "lineId": 117,
      "nbuCode": "660104",
      "name": "Glucemia",
      "defaultValue": "127",
      "unit": "mg/dL",
      "rule": {
        "sex": null,
        "ageFromYears": null,
        "band": { "low": "70", "high": "100", "criticalLow": null, "criticalHigh": "400" }
      }
    }
  ]
}
```

### POST `/api/reports/42/emit`

Response 200:
```json
{
  "ok": true,
  "path": "42/00000011.pdf"
}
```

## Swagger UI

Disponible automáticamente en `/api/docs`. Cada `@ApiProperty`, `@ApiTags`, etc. genera la spec OpenAPI. Útil para que el front (o testers) exploren la API.
