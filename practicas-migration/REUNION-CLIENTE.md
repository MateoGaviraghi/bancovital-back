# Migración NBU → catálogo de prácticas — Documento para la reunión con el cliente

> **Objetivo de este documento:** dejar por escrito QUÉ se migró, QUÉ se decidió, y TODAS
> las dudas abiertas, para resolverlas en la reunión y que después no quede ninguna
> ambigüedad sobre qué corregir, qué cambiar y cómo implementarlo.
>
> Cada pregunta tiene un espacio **`Respuesta cliente:`** para completar en la reunión.

Fecha de la migración: 2026-05-17 · Estado: **cargado en la base de datos de producción** (idempotente, se puede volver a correr).

---

## 1. Resumen de lo cargado

| Dato | Valor |
|---|---|
| Prácticas NBU cargadas | **1445** (0 perdidas — verificado contra los 3 PDF) |
| Total en la tabla `practice` | 1449 (1445 NBU + 4 del seed inicial: Glucemia, Hemograma, Colesterol, Sobrecarga) |
| Sin valor U.B. en el nomenclador | 175 (se guardaron igual, con nota de procedencia) |
| Inactivas (Prácticas en Desuso) | 68 |
| Marcadas para revisión de NOMBRE | 43 (ver sección 5) — el U.B. de todas está garantizado |
| Discrepancias de U.B. vs PDF | **0** (1270 verificadas una por una contra el PDF) |

**Fuentes:** `NBU-Version-2012-Act.-2016.pdf` (base) + `Anexo-11.2023` + `Anexo-01.2024`.
Regla aplicada: el catálogo base se pisa con el Anexo 2023 y luego con el 2024 (gana el más nuevo); ningún código se descarta. 30 prácticas tomaron el U.B. actualizado del Anexo 2024.

**Distribución por sección:**

| Sección | Cantidad | Sin U.B. | Inactivas |
|---|---|---|---|
| Prácticas Especiales | 1005 | 85 | 0 |
| Prácticas Generales | 370 | 22 | 0 |
| Prácticas en Desuso | 68 | 68 | 68 |
| Gestión Administrativa | 2 | 0 | 0 |
| (seed previo: química/hematología) | 4 | 0 | 0 |

---

## 2. Decisiones ya tomadas (CONFIRMAR con el cliente)

Estas se tomaron para poder avanzar. Hay que validarlas en la reunión:

1. **Se migran TODAS las prácticas**, incluso las que no tienen U.B. y las "en desuso" (nada se descarta).
   - `Confirma el cliente? (SÍ / NO / matiz):` __________________________________________
2. **Prácticas sin U.B.** → se guardan con `units = NULL` + nota "Sin U.B. en el nomenclador". **No se pueden facturar** hasta que tengan un valor (el sistema lo rechaza con un error claro al crear la orden).
   - `Respuesta cliente:` __________________________________________
3. **Prácticas en Desuso** → cargadas pero **inactivas** (no aparecen para facturar).
   - `Respuesta cliente:` __________________________________________
4. Se mapeó solo: código NBU, nombre, U.B. (units), sección, nota de procedencia, y "acto bioquímico" (código 001). Los flags de Urgencia / Ref. del nomenclador **NO** se mapearon todavía.
   - `Respuesta cliente:` __________________________________________

---

## 3. DUDAS ABIERTAS — núcleo de la reunión

### 3.1 ¿Cada código NBU es UNA práctica, o hay perfiles/baterías/flujos?

El NBU lista códigos individuales. Pero en el día a día un laboratorio suele facturar
**baterías/perfiles** (ej.: "Perfil tiroideo" = TSH + T3 + T4; "Hemograma" ya es un combo;
"Chequeo prequirúrgico" = N prácticas). Hoy el sistema modela **una orden = varias prácticas
individuales**, no tiene concepto de "perfil" que agrupe varias.

- ¿El cliente carga las prácticas **una por una** o pide por **perfiles/paquetes**?
  `Respuesta cliente:` __________________________________________
- Si usa perfiles: ¿cuáles son los más comunes y qué prácticas incluye cada uno?
  `Respuesta cliente:` __________________________________________
- ¿El perfil tiene un precio propio o es la suma de las prácticas?
  `Respuesta cliente:` __________________________________________
- ¿Hace falta que el sistema tenga "perfiles" como entidad, o alcanza con seleccionar varias prácticas sueltas?
  `Respuesta cliente:` __________________________________________

> **Impacto técnico:** si necesitan perfiles, es una funcionalidad nueva (entidad
> "perfil/batería" + UI de selección). Definir alcance acá.

### 3.2 Las 175 prácticas sin U.B.

El nomenclador no les asigna U.B. (aparecen en blanco o con "-").

- ¿El cliente las realiza? ¿Les pone un **precio propio**?
  `Respuesta cliente:` __________________________________________
- ¿Se cobran como "particular" con un valor manual, o no se ofrecen?
  `Respuesta cliente:` __________________________________________
- ¿Quiere poder cargar el U.B. a mano por práctica desde el sistema?
  `Respuesta cliente:` __________________________________________

### 3.3 Valor monetario del U.B. (cómo se calcula el precio)

El NBU da **unidades**, no pesos. Precio = `unidades × valor del U.B.`, y ese valor lo
fija cada obra social (la tabla `ub_value` ya existe en el sistema).

- ¿El cliente tiene los **valores de U.B. por obra social** vigentes? ¿Quién los actualiza y cada cuánto?
  `Respuesta cliente:` __________________________________________
- ¿El valor de U.B. del particular es distinto al de las obras sociales?
  `Respuesta cliente:` __________________________________________
- ¿Hay obras sociales que pagan un % o un plus por urgencia?
  `Respuesta cliente:` __________________________________________

### 3.4 ¿Requiere autorización? (columnas U / N del nomenclador)

El NBU trae columnas "Urgencia" y "Ref." con marcas U/N que no mapeamos (su significado
no es unívoco). El sistema tiene un campo `requiresAuthorization` por práctica, hoy en `false` para todas.

- ¿La autorización depende de la **práctica** o de la **obra social**? (creemos que es por obra social)
  `Respuesta cliente:` __________________________________________
- ¿Hay prácticas que SIEMPRE requieren autorización sin importar la obra social? ¿Cuáles?
  `Respuesta cliente:` __________________________________________

### 3.5 Nombre corto / categoría propia

Los campos `shortName` (nombre corto) y `category` quedaron vacíos.

- ¿El cliente quiere **nombres cortos** para tickets / PDF / pantalla? ¿Tiene su propia lista de nombres?
  `Respuesta cliente:` __________________________________________
- ¿Agrupa las prácticas por **sector del laboratorio** (química, hematología, microbiología, hormonas, etc.) en vez de las secciones del NBU?
  `Respuesta cliente:` __________________________________________

### 3.6 Secciones

Quedaron 4 secciones del NBU: Generales, Especiales, En Desuso, Gestión Administrativa.

- ¿Le sirven así o prefiere otra agrupación para buscar/filtrar? (relacionado con 3.5)
  `Respuesta cliente:` __________________________________________

### 3.7 Búsqueda por sinónimos

El NBU tiene un anexo de "sinonimias" (nombres alternativos) que **excluimos** de la
migración (no son prácticas, son alias).

- ¿El cliente busca prácticas por **nombres alternativos** (ej. "hepatograma" vs "perfil hepático")? ¿Hace falta búsqueda por sinónimos?
  `Respuesta cliente:` __________________________________________

### 3.8 Las 4 prácticas del seed inicial (códigos 0301, 0501, 0902, 8801)

Son prácticas de prueba que ya estaban (Glucemia, Hemograma, Colesterol, Sobrecarga de
glucosa) con códigos cortos que **no** son códigos NBU. Conviven con las 1445 nuevas.

- ¿Se eliminan? ¿O se mapean a su código NBU real (Glucemia NBU = 660xxx)?
  `Respuesta cliente:` __________________________________________
- (Estas 4 tienen valores de referencia configurados; las NBU no. Ver 3.9.)

### 3.9 Valores de referencia (rangos normales)

Las prácticas NBU se cargaron **sin** valores de referencia (el nomenclador no los trae).
El sistema sí soporta `referenceValueTemplate` (rangos por sexo/edad para informar resultados).

- ¿El cliente tiene una tabla de valores de referencia? ¿Para cuáles prácticas?
  `Respuesta cliente:` __________________________________________
- ¿Es prioridad cargarlos ahora o en una etapa posterior?
  `Respuesta cliente:` __________________________________________

### 3.10 Versión del nomenclador / actualizaciones futuras

Usamos NBU 2012 (act. 2016) + Anexo 2023 + Anexo 2024.

- ¿El cliente usa exactamente este nomenclador, o tiene **precios/prácticas propias** que difieren del NBU?
  `Respuesta cliente:` __________________________________________
- ¿Hay anexos más nuevos (2025/2026) que deba contemplar?
  `Respuesta cliente:` __________________________________________
- Cuando salga un anexo nuevo, ¿cada cuánto hay que reimportar? (el proceso es repetible)
  `Respuesta cliente:` __________________________________________

---

## 4. Cómo se modela hoy (para explicar en la reunión)

- **Práctica** = un registro individual (código NBU, nombre, unidades U.B., sección).
- **Orden** = un paciente + una obra social + N prácticas (sueltas). El precio de cada
  práctica = `unidades × valor U.B. de esa obra social` (+ acto bioquímico si corresponde).
- **No existe** hoy el concepto de "perfil/batería" ni de "flujo". Si el cliente trabaja
  así, hay que definirlo (ver 3.1).
- Una práctica **sin U.B.** no se puede poner en una orden facturable (el sistema avisa).
- Una práctica **inactiva** (en desuso) no aparece para seleccionar.

---

## 5. Garantía de los datos y nombres a revisar

### Cómo se garantizó (no es "confianza", es triangulación)

Cada dato lo derivan métodos independientes y se exige que coincidan
(`pnpm verify-nbu`, gate permanente que falla si algo no triangula):

| Verificación | Método independiente | Resultado |
|---|---|---|
| **Código + U.B.** | 2 algoritmos distintos (umbral X vs estructural PMO/PE) | **1445/1445 idénticos, 0 discrepancias** |
| **Cobertura** | enumeración de todo código en los 3 PDF | **1445/1445, 0 faltantes** |
| **Verdad humana** | capturas del cliente | 21/21 OK |
| **Nombres** | 2º motor PDF (Poppler) vs el nuestro (PyMuPDF) | 1413 ok, **32 a revisar** |

**El U.B. (lo que define el precio) está garantizado para las 1445.** Lo
único no garantizable por software es el TEXTO del nombre cuando el
nomenclador lista la misma práctica con un sinónimo — el software no sabe
cuál prefiere el cliente. Esos 32 (+11 de la heurística = 43 `needsReview`
en el dataset) son los únicos a validar acá. **Ninguno afecta el precio.**

### Las 32 — elegir el nombre preferido (la mayoría son sinónimos válidos)

"Nuestro" = lo que se cargó. "Alternativo" = otro nombre del mismo código
en el PDF (suele ser el sinónimo). Marcá cuál querés, o escribí el correcto:

| Código | U.B. | Nuestro (cargado) | Alternativo (PDF) | ¿Cuál? |
|---|---|---|---|---|
| 660057 | 10 | (α1 ANTITRIPSINA, Alfa 1 AT) Líq. Pleural… | ANTITRIPSINA, Alfa 1 (α1 AT) - Líq. Pleural… |  |
| 660058 | 30 | ANTITROMBINA FUNCIONAL | ANTITROMBINA III - con calibración 3 puntos |  |
| 660170 | 6 | COAGULOGRAMA BÁSICO | COAGULO, RETRACCION DEL |  |
| 660176 | 2 | COLONIAS, RECUENTO DE | COLONIAS, RECUENTO - Comprende Recuento… |  |
| 660418 | 13 | GLUCOSA 6-FOSFATO ISOMERASA | FOSFO HEXOSA ISOMERASA - GLUCOSA 6-FOSFATO |  |
| 660711 | 5 | ORINA COMPLETA | (ruido Poppler — el nuestro es correcto) |  |
| 660739 | 13,5 | PARATHORMONA PTH | PARATHORMONA molécula intacta (PTH mi/i) |  |
| 660753 | s/UB | POTASEMIA | (ruido Poppler — el nuestro es correcto) |  |
| 660754 | s/UB | POTASURIA | (ruido Poppler — el nuestro es correcto) |  |
| 660838 | 20 | SIMS HUHNER, TEST DE | TEST POST-COITAL - TEST DE SIMS-HUBNER |  |
| 661050 | 17,5 | DROGAS de ABUSO SCREENING (c/u) | OPIACEOS, DROGAS de ABUSO SCREENING - urin. |  |
| 661135 | 15 | MONITOREO de FARMACOS ENF. CRONICAS I | DIFENILHIDANTOINA, MONITOREO FÁRMACOS… |  |
| 661136 | 24 | MONITOREO de FARMACOS ENF. CRONICAS II | LAMOTRIGINA, MONITOREO FARMACOS… |  |
| 661170 | 8 | SUBUNIDAD BETA GONADOTROFINA CORIÓNICA β-HCG (cualit.) | GONADOTROFINA CORIONICA, SUBUNIDAD BETA |  |
| 661175 | 14 | SUBUNIDAD BETA GONADOTROFINA CORIÓNICA β-HCG (cuant.) | GONADOTROFINA CORIONICA, SUBUNIDAD BETA |  |
| 661200 | 3 | URGENCIAS | (ruido Poppler — el nuestro es correcto) |  |
| 662538 | 60 | (α-HCH) Alfa-BHC … HEXACLOROCICLOHEXANO | alfa-HEXACLORAN - alfa-LINDANO - alfa-… |  |
| 662709 | 30 | ANTICOAGULANTE LÚPICO | (ruido Poppler — el nuestro es correcto) |  |
| 663067 | 300 | BIOTINA | VITAMINA H, Vit. B7 o Vit. B8 |  |
| 665055 | 45 | EXTASIS MDMA (Inmunoensayo) | 3,4-METILETILENDIOXIMETAMFETAMINA (MDMA) |  |
| 665785 | 330 | HEMOCROMATOSIS, Gen HFE PCR (… HEREDITARIA) | (mismo, orden distinto) |  |
| 666722 | 2 | INDICE de RIESGO CARDIOVASCULAR | (ruido Poppler — el nuestro es correcto) |  |
| 666848 | 162 | INMUNOFIJACIÓN LCR | (ruido Poppler — el nuestro es correcto) |  |
| 666947 | 20 | LC-1, Ac. Anti | Anti- hígado tipo I-antígeno citosol |  |
| 667210 | 20 | LISOZIMA | MURAMIDASA |  |
| 667260 | 60 | LIXITOL | ARABINITOL o ARABITOL |  |
| 667636 | 220 | MuSK, Ac. Anti | TIROSINA KINÉTICA MÚSCULO ESPECÍFICO (MuSK) |  |
| 668467 | 106 | POLIOMAVIRUS JC, PCR LCR | VJC (PCR) - JC VIRUS, LCR (PCR) |  |
| 668682 | 12 | PROTOPORFIRINA ERITROCITARIA LIBRE (FEP)… | ZINC PROTOPORFIRINA (ZPP o ZP)… |  |
| 669118 | 35 | SOMATOMEDINA C - IGFB1 | FACTOR DE CRECIMIENTO INSULÍNICO TIPO 1 |  |
| 669896 | 30 | VITAMINA C (líquido seminal) | ÁCIDO ASCÓRBICO (líquido seminal) |  |
| 669898 | 30 | VITAMINA C (plaquetaria) | ÁCIDO ASCÓRBICO (plaquetario) |  |

> La mayoría son **sinónimos válidos** (BIOTINA = Vitamina H, LISOZIMA =
> Muramidasa, VITAMINA C = Ác. Ascórbico…): ambos nombres son correctos,
> el cliente elige cuál mostrar. Los marcados "ruido Poppler" ya están
> bien cargados. **El U.B. y el código de las 32 están garantizados.**

---

## 6. Notas técnicas (no hace falta leerlas en la reunión)

- Pipeline en `practicas-migration/`: `extract.py` (extracción) → `nbu-dataset.json`
  (fuente de verdad revisable) → `validate.py` (control de integridad) →
  `pnpm db:import-nbu` (carga idempotente, upsert por código NBU).
- Reimportar es seguro: vuelve a correr `extract.py` y `pnpm db:import-nbu` y solo
  actualiza lo que cambió, sin duplicar.
- Cambios de schema aplicados: `units` ahora puede ser nulo; se agregó columna `notes`
  (procedencia de cada práctica).
- Pendiente según lo que se decida: flags Urgencia/Ref, perfiles/baterías, valores de
  referencia, nombres cortos, limpieza de las 4 prácticas seed.

---

## 7. Acciones post-reunión (completar después)

- [ ] Confirmar decisiones de la sección 2.
- [ ] Resolver dudas 3.1 a 3.10.
- [ ] Validar/elegir nombre de las 32 de la sección 5.
- [ ] Lista de cambios a implementar acordados:
  1. ____________________________________________
  2. ____________________________________________
  3. ____________________________________________
- [ ] Prioridad / orden de implementación: ____________________________________________
