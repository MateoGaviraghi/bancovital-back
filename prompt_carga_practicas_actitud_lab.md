# Prompt para Claude Code — Actualización de unidades, valores de referencia y resultados predefinidos en Actitud+ Lab

Contexto: ya tenés las prácticas creadas en el sistema (LIS Actitud+ Lab), pero faltan actualizar las unidades de medida, los valores/opciones seleccionables de cada campo y los resultados automáticos predefinidos. Un bioquímico me pasó el detalle real de cómo se informan estas prácticas en el laboratorio. Cargá/actualizá lo siguiente respetando la estructura de datos y el modelo de prácticas que ya conocés del sistema.

---

## 1. UROCULTIVO

**Muestra:** Orina de chorro medio.

### Examen físicoquímico (campos tipo lista desplegable, no texto libre)
- **Color:** Amarillo claro / Amarillo ámbar / Amarillo oscuro / Rojizo / Rojo oscuro / Marrón
- **Aspecto:** Límpido / Ligeramente turbio / Turbio
- **pH:** 5 / 6 / 7 / 8 / 9
- **Densidad:** 1000 / 1005 / 1010 / 1020 / 1025 / 1030
- **Nitritos:** No contiene / Contiene (+)
- **Glucosa:** No contiene / Contiene (+) / Contiene (++)
- **Proteínas:** Escala de cruces: + / ++ / +++ / ++++
- **Bilirrubina:** misma escala de cruces que proteínas (no contiene / + / ++ / +++)
- **Hemoglobina:** misma escala de cruces
- **Cetonas:** misma escala de cruces
- **Urobilinógeno:** Normal / + / ++ / +++ / etc. (escala de cruces)

### Examen microscópico directo
- **Leucocitos** (campo por rango, seleccionable):
  - Escasos: 0-1 / 1-3 / 4-5
  - Regular: 5-7 / 7-9
  - Abundante: 10-15 / 15-20 / >20
  - Opción adicional: "Campo cubierto" (cpo cubierto)
- **Hematíes** (mismo formato de rangos):
  - 0-2 / 3-5 / 6-10 / 10-20 / >20
  - Opción adicional: "Campo cubierto"
- **Células epiteliales:** Escasas (E) / Regulares (R) / Abundantes (A)
- **Cilindros:** tipos seleccionables — Hialinos / Granulosos / Eritrocitarios / Leucocitarios; con cantidad Escasos (E) / Regulares (R) / Abundantes (A)
- **Piocitos:** Escasos (E) / Regulares (R) / Abundantes (A)
- **Cristales:** ver sección 4 "Cristales urinarios" más abajo — debe permitir **selección múltiple** (ej. oxalato de calcio + uratos amorfos en la misma muestra)

### Cultivo
- Negativo. No se observó desarrollo bacteriano significativo luego de 24/48 horas de incubación.
- Desarrollo bacteriano significativo.
  - Microorganismo aislado (ver tabla maestra abajo)
  - Recuento: <10.000 UFC/mL / 10.000–100.000 UFC/mL / >100.000 UFC/mL / Recuento estimado (campo numérico) UFC/mL

### Antibiograma (panel de antibióticos con resultado S/I/R)
Ampicilina, Amoxicilina/Clavulánico, Piperacilina/Tazobactam, Cefazolina, Cefuroxima, Cefotaxima, Ceftriaxona, Ceftazidima, Cefepime, Aztreonam, Ertapenem, Imipenem, Meropenem, Amikacina, Gentamicina, Tobramicina, Ciprofloxacina, Levofloxacina, Trimetoprima/Sulfametoxazol, Nitrofurantoína, Fosfomicina.
Interpretación: S = Sensible / I = Sensible con aumento de exposición / R = Resistente

### Resultados automáticos predefinidos (para carga rápida)
- Sin desarrollo bacteriano.
- Desarrollo de microbiota mixta compatible con contaminación.
- Desarrollo polimicrobiano. Se sugiere repetir muestra.
- Desarrollo de levaduras compatibles con Candida spp.
- Recuento no significativo (<10.000 UFC/mL).
- Desarrollo bacteriano significativo (>100.000 UFC/mL).
- Muestra inadecuada para procesamiento.

### Tabla maestra de microorganismos (Urocultivo)
Escherichia coli, Klebsiella pneumoniae, Klebsiella oxytoca, Proteus mirabilis, Proteus vulgaris, Morganella morganii, Citrobacter freundii, Enterobacter cloacae, Serratia marcescens, Pseudomonas aeruginosa, Acinetobacter baumannii, Enterococcus faecalis, Enterococcus faecium, Staphylococcus aureus, Staphylococcus saprophyticus, Streptococcus agalactiae, Candida albicans, Candida tropicalis, Candida glabrata.

---

## 2. COPROCULTIVO

**Muestra:** Materia fecal.

### Examen microscópico directo
- Leucocitos fecales (campo numérico/rango)
- Hematíes
- Levaduras
- Parásitos observados
- Otros hallazgos

### Cultivo
- Negativo para enteropatógenos.
- Desarrollo de microorganismo enteropatógeno → Microorganismo aislado (tabla maestra) + Desarrollo: Escaso / Moderado / Abundante
- Identificación: Género / Especie (campos separados)

### Antibiograma (solo cuando corresponde)
Ampicilina, Amoxicilina/Clavulánico, Cefotaxima, Ceftriaxona, Ceftazidima, Ciprofloxacina, Trimetoprima/Sulfametoxazol, Azitromicina, Cloranfenicol.
Interpretación: S/I/R.

### Tabla maestra de microorganismos (Coprocultivo)
Salmonella spp., Salmonella enterica, Shigella spp., Shigella sonnei, Shigella flexneri, Aeromonas spp., Plesiomonas shigelloides, Vibrio spp., Vibrio cholerae, Campylobacter jejuni, Campylobacter coli, Yersinia enterocolitica, Escherichia coli enteropatógena.

### Resultados automáticos predefinidos
- < 5 PMN / campo 40X
- \> 30 PMN / campo 40X
- Negativo para Salmonella spp. y Shigella spp.
- Negativo para enteropatógenos investigados.
- Desarrollo de microbiota intestinal habitual.
- No se aislaron enteropatógenos.
- Desarrollo de Salmonella spp.
- Desarrollo de Shigella spp.
- Desarrollo de Aeromonas spp.
- Desarrollo de Campylobacter spp.
- Desarrollo de flora bacteriana habitual.

---

## 3. ESTUDIO MICOLÓGICO

**Muestra:** campo libre (piel, uñas, cabello, mucosas, según pedido).

### Examen directo
- Preparación: KOH / KOH + Tinta / Blanco de Calcoflúor / Otro (texto libre)
- Resultado: Negativo para elementos micóticos / Positivo para elementos micóticos
- Hallazgos (selección múltiple): Hifas hialinas septadas / Hifas hialinas no septadas / Artroconidias / Blastoconidias / Pseudohifas / Levaduras / Otros

### Cultivo micológico
- Negativo luego de ___ días de incubación (campo numérico de días)
- Desarrollo fúngico → Género / Especie + Cantidad: Escaso / Moderado / Abundante

### Tabla maestra de microorganismos (Micológico)
**Dermatofitos:** Trichophyton rubrum, Trichophyton mentagrophytes, Trichophyton interdigitale, Trichophyton tonsurans, Trichophyton verrucosum, Microsporum canis, Microsporum gypseum, Epidermophyton floccosum.
**Levaduras:** Candida albicans, Candida tropicalis, Candida glabrata, Candida parapsilosis, Candida krusei, Candida auris, Rhodotorula spp., Cryptococcus spp.
**Mohos oportunistas:** Aspergillus fumigatus, Aspergillus flavus, Aspergillus niger, Fusarium spp., Scopulariopsis spp., Acremonium spp.

### Resultados automáticos predefinidos
- Negativo para elementos micóticos.
- Negativo para dermatofitos.
- Desarrollo de dermatofito.
- Desarrollo de levaduras del género Candida.
- Desarrollo de moho ambiental. Correlacionar con cuadro clínico.
- Desarrollo de flora fúngica saprofita.
- Cultivo contaminado. Se recomienda nueva muestra.

### Variante: Onicomicosis (uñas)
Agregar como sub-tipo de práctica o campos adicionales:
- Aspecto de la muestra
- Directo: Positivo / Negativo
- Cultivo: Positivo / Negativo
- Dermatofito aislado (campo)
- Levadura aislada (campo)
- Moho no dermatofito aislado (campo)

Nota importante: el sistema debe permitir informar **Directo positivo + Cultivo negativo** como combinación válida (es un resultado clínicamente relevante y frecuente en uñas), no forzar concordancia entre ambos campos.

---

## 4. CRISTALES URINARIOS (campo transversal, usado en Urocultivo y Orina Completa)

El campo "Cristales" debe permitir **selección múltiple** (más de un tipo de cristal en la misma muestra, ej. oxalato de calcio + uratos amorfos).

### Tabla maestra de cristales
**Orina ácida:** Oxalato de calcio, Ácido úrico, Uratos amorfos, Cistina, Leucina, Tirosina.
**Orina alcalina:** Fosfato triple (estruvita), Fosfatos amorfos, Fosfato de calcio, Carbonato de calcio, Biurato de amonio.
**Patológicos / poco frecuentes:** Sulfonamidas, Bilirrubina, Colesterol, Cristales de fármacos.

### Formato de informe por cristal
- Tipo (selección de tabla maestra, múltiple)
- Cantidad: Ausentes / Escasos (+) / Moderados (++) / Abundantes (+++) / Muy abundantes (++++)
- Observaciones (texto libre)

Ejemplos de salida esperada: "Cristales de oxalato de calcio: Escasos (+)"; "Cristales de fosfato triple: Abundantes (+++)".

---

## 5. COPROPARASITOLÓGICO

**Muestra:** Materia fecal.

### Método (selección)
Examen directo / Concentración / Faust / Ritchie / Willis / Kato-Katz / Otro.

### Examen macroscópico
Color, Consistencia, Moco, Sangre visible, Parásitos adultos observados (todos texto libre/corto).

### Examen microscópico
- Protozoarios: No observados / Quistes de (tabla maestra) / Trofozoítos de (tabla maestra)
- Helmintos: No observados / Huevos de / Larvas de / Adultos de (tabla maestra)
- Levaduras, Otros hallazgos (texto libre)

### Tabla maestra — Protozoarios
**Patógenos:** Giardia duodenalis (lamblia), Entamoeba histolytica, Blastocystis spp., Dientamoeba fragilis, Cryptosporidium spp., Cyclospora cayetanensis, Cystoisospora belli.
**Comensales:** Entamoeba coli, Endolimax nana, Iodamoeba bütschlii, Chilomastix mesnili, Enteromonas hominis.

### Tabla maestra — Helmintos
**Nematodos:** Enterobius vermicularis, Ascaris lumbricoides, Trichuris trichiura, Ancylostoma duodenale, Necator americanus, Strongyloides stercoralis.
**Cestodos:** Taenia spp., Hymenolepis nana, Hymenolepis diminuta, Diphyllobothrium spp.
**Trematodos:** Fasciola hepatica, Schistosoma spp.

### Resultados automáticos predefinidos
- Negativo para formas parasitarias.
- No se observaron protozoarios ni helmintos.
- Se observaron quistes de Giardia duodenalis.
- Se observaron quistes de Blastocystis spp.
- Se observaron huevos de Enterobius vermicularis.
- Se observaron huevos de Ascaris lumbricoides.
- Se observaron formas compatibles con Entamoeba coli (comensal intestinal).
- Se observaron levaduras en cantidad escasa/moderada/abundante.

---

## 6. ESPERMOCULTIVO

**Muestra:** Semen.

### Examen microscópico directo
Leucocitos, Hematíes, Células epiteliales, Bacterias, Levaduras, Otros hallazgos (campos numéricos/texto).

### Cultivo
- Negativo. No se observó desarrollo microbiano significativo luego de 24/48 horas de incubación.
- Desarrollo microbiano → Género / Especie + Desarrollo: **Sin desarrollo / Escaso / Moderado / Abundante / 100.000 UFC/mL** (agregar la opción de cuantificación numérica además de las cualitativas, porque los urólogos suelen pedir cuantificación cuando hay bacteriospermia significativa).

### Antibiograma
Ampicilina, Amoxicilina/Clavulánico, Piperacilina/Tazobactam, Cefotaxima, Ceftriaxona, Ceftazidima, Cefepime, Imipenem, Meropenem, Gentamicina, Amikacina, Ciprofloxacina, Levofloxacina, Trimetoprima/Sulfametoxazol, Nitrofurantoína, Fosfomicina.
Interpretación: S/I/R.

### Tabla maestra de microorganismos (Espermocultivo)
Escherichia coli, Enterococcus faecalis, Enterococcus faecium, Klebsiella pneumoniae, Proteus mirabilis, Pseudomonas aeruginosa, Staphylococcus aureus, Streptococcus agalactiae, Candida albicans.

### Resultados automáticos predefinidos
**Negativos:** No se observó desarrollo microbiano significativo. / Cultivo seminal negativo.
**Positivos:** Desarrollo de Escherichia coli. / Desarrollo de Enterococcus faecalis. / Desarrollo de Enterococcus faecium. / Desarrollo de Klebsiella pneumoniae. / Desarrollo de Proteus mirabilis. / Desarrollo de Pseudomonas aeruginosa. / Desarrollo de Staphylococcus aureus. / Desarrollo de Streptococcus agalactiae. / Desarrollo de Candida albicans.
**Observaciones automáticas:** Flora polimicrobiana compatible con contaminación de la muestra. / Desarrollo de microbiota urogenital habitual. / Correlacionar con hallazgos clínicos. / Se recomienda nueva muestra ante sospecha de contaminación.

### Campos internos adicionales a habilitar
Fecha y hora de eyaculación, Tiempo hasta el procesamiento, Método de obtención, Medios utilizados, Recuento bacteriano, Identificación bioquímica, BLEE, Carbapenemasa, Observaciones técnicas.

---

## 7. BÚSQUEDA DE STREPTOCOCCUS GRUPO B (Streptococcus agalactiae)

**Muestra:** Exudado vaginal / Exudado rectal / Exudado vaginorrectal / Otra (texto libre).

### Cultivo
- Negativo para Streptococcus agalactiae (Grupo B).
- Positivo para Streptococcus agalactiae (Grupo B).

### Antibiograma (cuando corresponde)
Penicilina, Ampicilina, Eritromicina, Clindamicina, Vancomicina. Interpretación S/I/R.

### Resultados automáticos predefinidos
- Negativo para Streptococcus agalactiae (Grupo B).
- No se aisló Streptococcus agalactiae.
- Positivo para Streptococcus agalactiae (Grupo B).
- Se aisló Streptococcus agalactiae.

### Observaciones predefinidas
- La colonización materna por Streptococcus agalactiae constituye un factor de riesgo para infección neonatal.
- Correlacionar con criterio obstétrico para profilaxis intraparto.
- Estudio realizado según recomendaciones para tamizaje prenatal entre las semanas 35 y 37 de gestación.

---

## 8. FROTIS DE SANGRE PERIFÉRICA

### Calidad de la muestra
Adecuada para evaluación morfológica / Regular / No adecuada.

### Serie roja
- Tamaño eritrocitario: Normocitosis / Microcitosis / Macrocitosis / Dimorfismo eritrocitario
- Variación de tamaño: Sin alteraciones / Anisocitosis leve / Anisocitosis moderada / Anisocitosis marcada
- Coloración: Normocromía / Hipocromía / Hipercromía
- Forma eritrocitaria: Sin alteraciones morfológicas / Poiquilocitosis, con selección múltiple de: Ovalocitos, Eliptocitos, Dianocitos, Esferocitos, Drepanocitos, Codocitos, Equinocitos, Acantocitos, Estomatocitos, Esquistocitos, Dacriocitos, Queratocitos, Otros
- Inclusiones eritrocitarias: No observadas / Cuerpos de Howell-Jolly / Punteado basófilo / Cuerpos de Heinz / Anillos de Cabot / Otros

### Serie blanca
- Neutrófilos: Morfología conservada / Granulaciones tóxicas / Vacuolización citoplasmática / Cuerpos de Döhle / Hipersegmentación / Hiposegmentación / Desviación a izquierda
- Linfocitos: Morfología conservada / Linfocitos reactivos / Linfocitos atípicos / Otros
- Monocitos: Morfología conservada / Alteraciones observadas
- Eosinófilos: Morfología conservada / Alteraciones observadas
- Basófilos: Morfología conservada / Alteraciones observadas
- Elementos inmaduros: No observados / Mielocitos / Metamielocitos / Promielocitos / Blastos / Otros

### Serie plaquetaria
- Cantidad estimada: Adecuada / Disminuida / Aumentada
- Morfología: Conservada / Plaquetas gigantes / Macroplaquetas / Microplaquetas / Agregados plaquetarios

### Hemoparásitos
No observados / Formas compatibles con (tabla maestra: Babesia spp., Mycoplasma spp., Ehrlichia spp., Anaplasma spp., Hepatozoon spp., Otros — uso veterinario).

### Grado de intensidad (aplicar a cada alteración seleccionada)
Leve (+) / Moderada (++) / Marcada (+++)
Ejemplos de salida: "Anisocitosis (+++)", "Hipocromía (++)", "Esquistocitos (+)".

### Observaciones automáticas predefinidas
- Morfología eritrocitaria conservada.
- Morfología leucocitaria conservada.
- Plaquetas adecuadas en número y morfología.
- No se observaron alteraciones morfológicas significativas.
- Se observan cambios reactivos compatibles con proceso inflamatorio.
- Se observan elementos inmaduros de la serie mieloide.
- Se observan linfocitos reactivos.

---

## 9. EXUDADO VAGINAL / FONDO DE SACO — Estado Vaginal Básico (EVB) (método convencional + BACOVA)

*(Esta práctica surge de una planilla del bioquímico que no estaba en la lista original — crear si no existe, o revisar si ya existe con otro nombre.)*

### Datos de cabecera
Apellido, Nombre, Fecha, Edad, FUM (fecha última menstruación), Embarazada (Sí/No), Sintomática (Sí/No), Hora de toma de la muestra, Hora del procesamiento.

### Características macroscópicas y fisicoquímicas
- Cantidad (texto/escala)
- Color (texto/lista)
- Aspecto (texto/lista)
- pH (numérico)
- Test de Aminas (Positivo/Negativo)

### Estudio microscópico del contenido vaginal
- Examen parasitológico: se observan / no se observan Trichomonas vaginalis
- Examen micológico: se observan / no se observan levaduras y/o pseudohifas
- Morfotipos bacterianos extraños: se observan / no se observan bacilos gram negativos compatibles con enterobacterias y cocos gram positivos (texto editable)
- RIV* (Reacción inflamatoria vaginal): Sí / No
- Células guía: Sí / No
- Valor numérico (corregido): campo numérico

### Diagnóstico de Estado Vaginal Básico (EVB) — lista de referencia (selección única)
- **EVB I** — Microbiota habitual
- **EVB II** — Microbiota habitual + RIV
- **EVB III** — Microbiota intermedia
- **EVB IV** — Vaginosis bacteriana
- **EVB V** — Vaginitis microbiana inespecífica

Campo de Observaciones asociado al EVB.

### Cultivo
Campo de resultado (ej: se observa / no se observa desarrollo de Complejo Candida albicans/dubliniensis/africana) + Observaciones.

### Conclusión
Campo de texto libre + Observaciones.

---

## 10. ESPUTO — Examen microscópico y Baciloscopía (BAAR)

*(También surge de las planillas del bioquímico; puede ser una práctica nueva o campos adicionales dentro de "Esputo" si ya existe.)*

### Examen microscópico — Celularidad
- Células epiteliales escamosas: < 10 cél/100x / > 10 cél/100x
- Leucocitos: > 25 leucocitos/campo (100x) / < 25 leucocitos/campo (100x)

### Gram
Selección múltiple con cantidad:
- Bacilos Gram (+) / Bacilos Gram (–)
- Cocos Gram (+) / Cocos Gram (–)

### Baciloscopía / Coloración de Ziehl-Neelsen — escala semicuantitativa estandarizada (informar SIEMPRE según esta tabla, no como texto libre)

| Número de BAAR observados (inmersión 1000X) | Informe |
|---|---|
| Ausencia de BAAR / 100 campos | No se observa BAAR |
| < 1 BAAR / 100 campos | Positivo (+) |
| Entre 1–10 BAAR / 50 campos | Positivo (++) |
| Más de 10 BAAR / 20 campos | Positivo (+++) |

Nota: en el informe general (Coloración de Gram) solo se informan **morfotipos predominantes**, no todos los morfotipos observados.

---

## 11. EXUDADO DE FAUCES

*(Práctica nueva a crear a partir de las notas del bioquímico.)*

### Examen microscópico
Campo de selección, **sin valor por defecto** (el bioquímico aclaró explícitamente que si no lo consigna, no debe aparecer en el informe final — el campo debe ser opcional y no generar texto si queda vacío):
- Asociación fusoespirilar
- Elementos levaduriformes

### Cultivo
Selección única:
- Streptococcus grupo A, C o G (especificar cuál al cargar)
- Arcanobacterium haemolyticum
- Desarrollo de microbiota habitual de vías respiratorias superiores

---

## Notas generales para la implementación

1. Todos los campos de "cantidad" que hoy son texto libre (leucocitos, hematíes, células epiteliales, cristales, etc.) deberían migrar a **listas desplegables con los rangos/escalas reales** detalladas arriba, en vez de campo numérico abierto — así se reduce variabilidad entre bioquímicos y se agiliza la carga.
2. Los campos de "Cristales" (Urocultivo/Orina completa) y "Morfotipos/alteraciones" (Frotis de sangre periférica, Gram de esputo) deben ser de **selección múltiple**, no única.
3. Cargar las tablas maestras de microorganismos como catálogos reutilizables entre prácticas (Urocultivo, Coprocultivo, Micológico, Espermocultivo, SGB) para no duplicar carga.
4. Los "resultados automáticos predefinidos" de cada práctica deben quedar como plantillas de texto seleccionables con un clic para agilizar el informe final, editables antes de guardar.
5. Confirmame si alguna de estas prácticas (EVB/Fondo de saco, Baciloscopía/BAAR, Exudado de fauces) no existe todavía en el sistema para crearla desde cero en lugar de solo actualizar unidades.
