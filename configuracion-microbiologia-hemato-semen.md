# Configuración de prácticas — Lote microbiología / hematología / semen

> Basado en las plantillas de informe enviadas por el bioquímico cliente. 
> Fecha: 2026-08-10.

## 0. Dos gaps de esquema a resolver ANTES de cargar (bloqueantes)

### 0.1 Antibiograma como estructura reusable
Espermocultivo, Streptococcus Grupo B (y a futuro cualquier cultivo con 
desarrollo positivo) necesitan una grilla antibiótico × resultado. Hoy no 
existe una tabla para esto. Propuesta:

```sql
CREATE TABLE antibiotico (
  id     bigint PRIMARY KEY,
  nombre text NOT NULL UNIQUE
);

CREATE TABLE practice_antibiograma (
  id             bigint PRIMARY KEY,
  practice_id    bigint NOT NULL REFERENCES practice(id),
  antibiotico_id bigint NOT NULL REFERENCES antibiotico(id),
  sort_order     integer NOT NULL DEFAULT 0,
  UNIQUE (practice_id, antibiotico_id)
);

CREATE TABLE order_practice_antibiograma_result (
  id                    bigint PRIMARY KEY,
  order_practice_id     bigint NOT NULL REFERENCES order_practice(id),
  antibiotico_id        bigint NOT NULL,
  antibiotico_snapshot  text NOT NULL,
  resultado             text CHECK (resultado IN ('S','I','R')),
  recuento_ufc_ml       text
);
```

### 0.2 Valores de referencia por franja etaria
`practice_unidad` hoy tiene un solo `range_low`/`range_high` global. Tu 
cliente pide 9 franjas (Recién nacido, Lactante, 1-2 años, 2-6 años, 6-12 
años, Adolescente mujer/hombre, Adulto mujer/hombre) con auto-selección por 
fecha de nacimiento. Cambio de modelo real:

```sql
CREATE TABLE practice_unidad_rango_etario (
  id                  bigint PRIMARY KEY,
  practice_unidad_id  bigint NOT NULL REFERENCES practice_unidad(id),
  franja              text NOT NULL,
  range_low           numeric,
  range_high          numeric
);
```

No hace falta resolverlo ya para Hemograma/Espermograma, pero conviene 
decidirlo antes de escalar a pediatría.

## 1. Espermograma — valores de referencia reales

Para ESPERMOGRAMA BASICO (id 135) / ESPERMA MODULO I (id 815):

**Macroscópico:**
- Licuefacción: < 60 min
- Viscosidad: ≤ 2 cm
- Apariencia: homogéneo, gris opalescente (preset)
- pH: ≥ 7,2
- Volumen: LRI 1,4 – 6 ml

**Espermiocitograma (límites inferiores, OMS):**
- Concentración (10⁶/ml): ≥ 15
- Espermatozoides totales (10⁶/eyaculado): ≥ 39
- Motilidad total (PR+NP) %: ≥ 40
- Motilidad progresiva (PR) %: ≥ 32
- Vitalidad %: ≥ 58
- Morfología normal (estricta) %: ≥ 4
- Concentración leucocitos (10⁶/ml): < 1
- Anticuerpos antiespermatozoides %: < 50

**Bioquímica del plasma seminal:**
- Ácido cítrico: V.R. 350–500 mg/dl
- Fructosa: V.R. 150–500 mg/dl
- Zinc (µmol/E): percentil 10 >3, percentil 5 ≥2,4
- Fosfatasa ácida (UI/E): percentil 10 >1234
- α-1,4 Glucosidasa neutra (mUI/E): percentil 10 >59, percentil 5 ≥20
- L-Carnitina (nmol/E): percentil 10 >654 (cinética enzimática) o >390 (colorimetría)

**Estudios funcionales (opcionales):**
- Test hipoosmótico: LRI > 58% membrana funcional
- Test azul de anilina: LRI > 70% cromatina madura
- Test naranja de acridina: LRI > 50% ADN nativo

## 2. Espermocultivo (id 2911) — ya tiene 27 unidades, completar

**Examen directo (preset):** Leucocitos, Hematíes, Células epiteliales, Bacterias, Levaduras, Otros hallazgos

**Cultivo — resultado (preset):**
- Negativo: "No se observó desarrollo microbiano significativo.", "Cultivo seminal negativo."
- Desarrollo: "Escaso", "Moderado", "Abundante", "100.000 UFC/mL"

**Microorganismos frecuentes (preset):**
Escherichia coli, Enterococcus faecalis, Enterococcus faecium, Klebsiella 
pneumoniae, Proteus mirabilis, Pseudomonas aeruginosa, Staphylococcus aureus, 
Streptococcus agalactiae, Candida albicans

**Antibiograma:**
Ampicilina, Amoxicilina/Clavulánico, Piperacilina/Tazobactam, Cefotaxima, 
Ceftriaxona, Ceftazidima, Cefepime, Imipenem, Meropenem, Gentamicina, 
Amikacina, Ciprofloxacina, Levofloxacina, Trimetoprima/Sulfametoxazol, 
Nitrofurantoína, Fosfomicina

**Observaciones predefinidas:**
"Flora polimicrobiana compatible con contaminación de la muestra.", 
"Desarrollo de microbiota urogenital habitual.", "Correlacionar con 
hallazgos clínicos.", "Se recomienda nueva muestra ante sospecha de 
contaminación."

## 3. Streptococcus Grupo B (id 1349, ya tiene 9 unidades)

**Muestra (preset):** Exudado vaginal, Exudado rectal, Exudado vaginorrectal, Otra

**Resultado (preset):**
- "Negativo para Streptococcus agalactiae (Grupo B).", "No se aisló Streptococcus agalactiae."
- "Positivo para Streptococcus agalactiae (Grupo B).", "Se aisló Streptococcus agalactiae."

**Antibiograma:** Penicilina, Ampicilina, Eritromicina, Clindamicina, Vancomicina

**Observaciones predefinidas:**
"La colonización materna por Streptococcus agalactiae constituye un factor 
de riesgo para infección neonatal.", "Correlacionar con criterio obstétrico 
para profilaxis intraparto.", "Estudio realizado según recomendaciones para 
tamizaje prenatal entre las semanas 35 y 37 de gestación."

## 4. Coproparasitológico — práctica NUEVA

Distinta de COPROCULTIVO (id 107, ya tiene 18 unidades — parte 
bacteriológica). Crear como práctica nueva para el examen microscópico.

**Macroscópico (preset):** Color, Consistencia, Moco (sí/no), Sangre visible (sí/no), Parásitos adultos observados

**Protozoarios patógenos:**
Giardia duodenalis (lamblia), Entamoeba histolytica, Blastocystis spp., 
Dientamoeba fragilis, Cryptosporidium spp., Cyclospora cayetanensis, 
Cystoisospora belli

**Protozoarios comensales:**
Entamoeba coli, Endolimax nana, Iodamoeba bütschlii, Chilomastix mesnili, 
Enteromonas hominis

**Helmintos nematodos:**
Enterobius vermicularis, Ascaris lumbricoides, Trichuris trichiura, 
Ancylostoma duodenale, Necator americanus, Strongyloides stercoralis

**Helmintos cestodos:** Taenia spp., Hymenolepis nana, Hymenolepis diminuta, Diphyllobothrium spp.

**Helmintos trematodos:** Fasciola hepatica, Schistosoma spp.

**Resultados automáticos (preset conclusión):**
"Negativo para formas parasitarias.", "No se observaron protozoarios ni 
helmintos.", "Se observaron quistes de Giardia duodenalis.", "Se observaron 
quistes de Blastocystis spp.", "Se observaron huevos de Enterobius 
vermicularis.", "Se observaron huevos de Ascaris lumbricoides.", "Se 
observaron formas compatibles con Entamoeba coli (comensal intestinal).", 
"Se observaron levaduras en cantidad escasa/moderada/abundante."

## 5. Frotis de sangre periférica (id 2912, ya tiene 16 unidades)

**Sin valores de referencia numéricos** — biblioteca de hallazgos 
morfológicos con intensidad (+/++/+++).

**Calidad de muestra:** Adecuada, Regular, No adecuada

**Serie roja:**
- Tamaño: Normocitosis, Microcitosis, Macrocitosis, Dimorfismo eritrocitario
- Variación: Sin alteraciones, Anisocitosis leve/moderada/marcada
- Coloración: Normocromía, Hipocromía, Hipercromía
- Forma: Sin alteraciones, Poiquilocitosis + Ovalocitos, Eliptocitos, 
  Dianocitos, Esferocitos, Drepanocitos, Codocitos, Equinocitos, 
  Acantocitos, Estomatocitos, Esquistocitos, Dacriocitos, Queratocitos
- Inclusiones: No observadas, Cuerpos de Howell-Jolly, Punteado basófilo, 
  Cuerpos de Heinz, Anillos de Cabot

**Serie blanca:**
- Neutrófilos: Morfología conservada, Granulaciones tóxicas, 
  Vacuolización citoplasmática, Cuerpos de Döhle, Hipersegmentación, 
  Hiposegmentación, Desviación a izquierda
- Linfocitos: Morfología conservada, Linfocitos reactivos, Linfocitos atípicos
- Monocitos/Eosinófilos/Basófilos: Morfología conservada, Alteraciones observadas
- Elementos inmaduros: No observados, Mielocitos, Metamielocitos, Promielocitos, Blastos

**Serie plaquetaria:**
- Cantidad: Adecuada, Disminuida, Aumentada
- Morfología: Conservada, Plaquetas gigantes, Macroplaquetas, Microplaquetas, Agregados

**Hemoparásitos:** No observados, Babesia spp., Mycoplasma spp., Ehrlichia 
spp., Anaplasma spp., Hepatozoon spp., Otros

**Intensidad:** cargar como sufijo en `opciones_predeterminadas` (ej. 
"Anisocitosis (+)") o agregar campo `intensidad` aparte.

**Observaciones automáticas:**
"Morfología eritrocitaria conservada.", "Morfología leucocitaria 
conservada.", "Plaquetas adecuadas en número y morfología.", "No se 
observaron alteraciones morfológicas significativas.", "Se observan cambios 
reactivos compatibles con proceso inflamatorio.", "Se observan elementos 
inmaduros de la serie mieloide.", "Se observan linfocitos reactivos."

## 6. Exudado de Fauces (id 2913) y Esputo

**Exudado de fauces:**
- Examen microscópico (opcional, condicional): "Asociación fusoespirilar", "Elementos levaduriformes"
- Cultivo: "Streptococcus grupo A", "Streptococcus grupo C o G", 
  "Arcanobacterium haemolyticum", "Desarrollo microbiota habitual de vías 
  respiratorias superiores"

**Esputo (práctica nueva):**
- Celularidad: "<10 células epiteliales escamosas/100x", ">10 células epiteliales escamosas/100x"
- Leucocitos: "≥25 leucocitos/campo 100x", "<25 leucocitos/campo 100x"
- Gram: Bacilos Gram+, Bacilos Gram-, Cocos Gram+, Cocos Gram-

## 7. Categorías de microbiología propuestas

| Categoría | Prácticas | Estado |
|---|---|---|
| Urocultivos | Urocultivo | ✅ existe (id 386) |
| Materia fecal | Coprocultivo ✅, Coproparasitológico ❌ | Parcial |
| Exudados | Fauces ✅, Vaginal (revisar id 388), Uretral (id 382), Endocervical, Ótico, Conjuntival, Nasal | Parcial |
| Respiratorios | Esputo, Aspirado traqueal, BAL | Pendiente |
| Sangre | Hemocultivo (id 208) | ✅ existe, revisar informe |
| Heridas | Secreción de herida, Absceso, Escara | Pendiente |
| Micología | Directo y cultivo (id 282/283) | ✅ existe |
| Líquidos estériles | LCR, Pleural, Ascítico, Sinovial, Pericárdico | Pendiente |
| Otros | Punta de catéter, Espermocultivo ✅, Strepto B ✅ | Parcial |

## 8. Prompt para Claude Code

```
Implementar las siguientes mejoras al sistema de laboratorio:

1. ESQUEMA — crear tabla de antibiograma reusable:
   antibiotico(id, nombre)
   practice_antibiograma(id, practice_id, antibiotico_id, sort_order)
   order_practice_antibiograma_result(id, order_practice_id, antibiotico_id,
     antibiotico_snapshot, resultado[S/I/R], recuento_ufc_ml)

2. CARGAR datos según el archivo adjunto 
   "configuracion-microbiologia-hemato-semen.md":
   - Espermograma (id 135 o 815): valores de referencia reales (sección 1)
   - Espermocultivo (id 2911): antibiograma + preset microorganismos + 
     observaciones (sección 2)
   - Streptococcus Grupo B (id 1349): antibiograma acotado + preset 
     resultado + observaciones (sección 3)
   - Crear práctica nueva "COPROPARASITOLÓGICO" con protozoarios y 
     helmintos como preset multi-select (sección 4)
   - Frotis de sangre periférica (id 2912): biblioteca de hallazgos 
     morfológicos con opciones_predeterminadas, SIN valores de referencia 
     numéricos (sección 5)
   - Exudado de Fauces (id 2913) y crear "Esputo": preset según sección 6

3. Crear las prácticas nuevas listadas en la tabla de la sección 7, 
   categorizadas según esa taxonomía.

No implementar todavía el sistema de rangos por franja etaria (sección 0.2) 
— documentarlo como deuda técnica pendiente de decisión de producto.
```
