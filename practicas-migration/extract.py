"""
NBU extraction pipeline.

Reads the 3 CUBRA-NBU PDFs by glyph coordinates (PyMuPDF).

Core idea: in this nomenclator a practice's NAME can wrap to lines that
sit ABOVE and BELOW its 6-digit code, with the code + U.B. vertically
centred in the name block. So rows cannot be reconstructed sequentially.
Instead every name token and the U.B. token is attached to the NEAREST
code anchor by Y distance. The U.B. always shares its code's Y (verified),
so it can never be bound to the wrong code.

A section state-machine (driven by large-font page titles) keeps only the
real price-list sections; Sinonimias / Abreviaturas / Referencias / Normas
/ Leyes are skipped. base + Anexo 2023 + Anexo 2024 are reconciled
(newest wins, no code dropped).

Output: nbu-dataset.json
"""
import json
import re
import sys
from decimal import Decimal

import fitz

sys.stdout.reconfigure(encoding="utf-8")

BASE = "NBU-Version-2012-Act.-2016.pdf"
ANEXO_2023 = "Anexo-11.2023-NBU-2012-16-Final.pdf"
ANEXO_2024 = "Anexo-01.2024-NBU-2012.pdf"

CODE_RE = re.compile(r"^\d{6}$")
UB_RE = re.compile(r"^\d{1,5}(?:[.,]\d{1,2})?$")
FLAG_RE = re.compile(r"^[UN]+$")
NAME_DROP = {"-", "(*)", "PMO", "U", "N", "UN", "NU"}
NAME_MAX_DY = 30.0   # a name line never sits farther than this from its code
NOISE = ("CUBRA", "Página", "CTP", "CÓDIGO", "CODIGO", "DETERMINACIONES",
         "Confederación", "NOMENCLADOR", "arancel", "Unidad", "Bioquímica",
         "obtiene", "multiplicando", "asignado", "corresponde", "ANEXO")

SKIP_KW = ("SINONIMIA", "ABREVIATURA", "REFERENCIAS", "NORMAS ESPECÍFICAS",
           "INTERPRETACIONES", "LEYES", "DECRETOS", "RESOLUCIONES")


def title_events(page):
    """Section titles can change MID-PAGE (a price list ends and a
    Sinonimias index begins lower on the same page). Return sorted
    [(y, classification)] grouping large-font (>=18pt) spans into title
    blocks; classification is the SKIP/INC tuple or None (ignored)."""
    spans = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            for sp in ln["spans"]:
                t = sp["text"].strip()
                if sp["size"] >= 18 and t and "CUBRA" not in t \
                        and "NOMENCLADOR" not in t and "N.B.U" not in t:
                    spans.append((sp["bbox"][1], t))
    spans.sort()
    events, gy, gtxt = [], None, []
    for y, t in spans:
        if gy is not None and y - gy > 40:
            events.append((gy, classify(" ".join(gtxt))))
            gtxt = []
        gy = y if not gtxt else gy
        if not gtxt:
            gy = y
        gtxt.append(t)
    if gtxt:
        events.append((gy, classify(" ".join(gtxt))))
    return [(y, c) for y, c in events if c is not None]


def classify(title: str):
    """SKIP keywords have top priority: a Sinonimias / Normas cover page
    also carries a '... del NBU - P.M.O.' subtitle that would otherwise
    be misread as a price list."""
    T = title.upper()
    if not T:
        return None
    if any(k in T for k in SKIP_KW):
        return ("SKIP", None, None)
    if "DESUSO" in T:
        return ("INC", "Prácticas en Desuso", False)
    if "ESPECIALES" in T:
        return ("INC", "Prácticas Especiales", True)
    if "GESTION ADMINISTRATIVA" in T or "GESTIÓN ADMINISTRATIVA" in T:
        return ("INC", "Gestión Administrativa", True)
    if "P.M.O" in T or "PMO" in T:
        return ("INC", "Prácticas Generales", True)
    return None


def extract_pdf(path, ub_left, name_right, *, sectioned, default_section,
                 default_active=True):
    doc = fitz.open(path)
    out = []
    # carry = (mode, section, active) flowing across page boundaries
    carry = (("SKIP", None, None) if sectioned
             else ("INC", default_section, default_active))

    for pi in range(len(doc)):
        page = doc[pi]
        text = page.get_text()
        events = title_events(page) if sectioned else []
        incoming = carry  # mode flowing in from the previous page
        if events:
            carry = events[-1][1]  # mode flowing out to the next page

        def mode_at(y):
            st = incoming
            for ey, ec in events:
                if ey <= y + 0.5:
                    st = ec
            return st

        if not (("CÓDIGO" in text or "CODIGO" in text) and "U. B." in text):
            continue

        # Drop EVERY column-header row (a page can hold two: a price-list
        # header up top and a Sinonimias-index header lower down). Each is
        # found by its strong marker tokens; remove words on those Y bands.
        raw = [w for w in page.get_text("words") if w[1] < 805]
        hdr_ys = [w[1] for w in raw
                  if w[4] in ("CÓDIGO", "CODIGO", "Urgencia", "Ref.",
                              "Frecuencia", "DETERMINACIONES")
                  or (w[4] in ("U.", "B.") and w[0] > 480)]
        # Y-bands of large-font section titles (sz>=18): body text is sz14,
        # so this deterministically stops any title bleeding into a name.
        title_ys = []
        for b in page.get_text("dict")["blocks"]:
            for ln in b.get("lines", []):
                for sp in ln["spans"]:
                    if sp["size"] >= 18 and sp["text"].strip():
                        title_ys.append(sp["bbox"][1])
        words = [w for w in raw
                 if not any(abs(w[1] - h) <= 3 for h in hdr_ys)
                 and not any(abs(w[1] - h) <= 12 for h in title_ys)]
        anchors = sorted(
            [(w[4], w[1]) for w in words if w[0] < 60 and CODE_RE.match(w[4])],
            key=lambda a: a[1])
        if not anchors:
            continue
        ays = [a[1] for a in anchors]

        # Block boundary between consecutive codes = midpoint of the LARGEST
        # vertical line-gap between their anchors. A practice name straddles
        # its code (lines above AND below); the inter-practice gap is always
        # the widest one in the region, so this never splits a name.
        line_ys = sorted({round(w[1], 1) for w in words})
        bounds = []  # bounds[i] = boundary y between anchor i and i+1
        for i in range(len(anchors) - 1):
            lo, hi = ays[i], ays[i + 1]
            # endpoints always included (epsilon avoids float-vs-rounded
            # dropping the anchor's own line and collapsing the gap calc)
            seq = [lo] + [y for y in line_ys if lo + 0.6 < y < hi - 0.6] + [hi]
            gap_at, gap = (lo + hi) / 2, -1.0
            for a, b in zip(seq, seq[1:]):
                if b - a > gap:
                    gap, gap_at = b - a, (a + b) / 2
            bounds.append(gap_at)
        lower = [ays[0] - NAME_MAX_DY] + bounds
        upper = bounds + [ays[-1] + NAME_MAX_DY]

        def owner(y):
            # words outside every practice band (section-cover prose,
            # intro paragraph) are dropped — no nearest fallback.
            for i in range(len(anchors)):
                if lower[i] - 0.5 < y <= upper[i] + 0.5:
                    return i
            return -1

        names = {i: [] for i in range(len(anchors))}
        ubs = {i: None for i in range(len(anchors))}

        for x0, y0, _x1, _y1, t, *_ in words:
            if x0 < 60 and CODE_RE.match(t):
                continue
            i = owner(y0)
            if i < 0:
                continue
            if x0 >= ub_left and (t == "-" or UB_RE.match(t)):
                if ubs[i] is None and abs(y0 - ays[i]) <= 6:
                    ubs[i] = None if t == "-" else Decimal(t.replace(",", "."))
            elif x0 < name_right:
                # NOTE: do NOT drop numeric tokens here — the U.B. lives in
                # the x>=ub_left branch above (mutually exclusive). Numbers
                # in the name column ARE part of the name ("17 CETOESTER.",
                # "1,25-VITAMINA D", etc.) and must be kept.
                if t in NAME_DROP or FLAG_RE.match(t):
                    continue
                if any(n in t for n in NOISE):
                    continue
                names[i].append((y0, x0, t))

        for i, (code, ay) in enumerate(anchors):
            st = mode_at(ay)
            if st[0] != "INC":
                continue
            toks = [t for _, _, t in sorted(names[i])]
            out.append({
                "code": code,
                "name": " ".join(toks),
                "units": ubs[i],
                "page": pi + 1,
                "section": st[1],
                "active": st[2],
            })
    return out


def clean_name(n: str) -> str:
    n = re.sub(r"\s+", " ", n).strip()
    n = re.sub(r"\s+([.,;:)])", r"\1", n)
    n = re.sub(r"\(\s+", "(", n)
    return n.strip(" .,-")


def main():
    base = extract_pdf(BASE, ub_left=515, name_right=420,
                        sectioned=True, default_section="Prácticas Generales")
    # Annex U.B. column sits at x~479-488 (a "PMO/PE" Frecuencia column
    # follows at x~535+). name_right=460 keeps the U/N flags and Frecuencia
    # out of names; ub_left=470 captures the U.B. (the flags U/N are <465
    # and dropped by FLAG_RE, Frecuencia text is non-numeric).
    a23 = extract_pdf(ANEXO_2023, ub_left=470, name_right=460,
                       sectioned=False, default_section="Anexo 11/2023")
    a24 = extract_pdf(ANEXO_2024, ub_left=470, name_right=460,
                       sectioned=False, default_section="Anexo 01/2024")

    catalog: dict[str, dict] = {}
    sources: dict[str, list[str]] = {}

    def apply(records, label):
        for r in records:
            r["name"] = clean_name(r["name"])
            if len(r["name"]) < 2:
                continue
            c = r["code"]
            sources.setdefault(c, [])
            if label not in sources[c]:
                sources[c].append(label)
            if c not in catalog:
                catalog[c] = r
            else:
                catalog[c]["name"] = r["name"]
                if r["units"] is not None:
                    catalog[c]["units"] = r["units"]

    apply(base, "NBU 2012 (Act. 2016)")
    apply(a23, "Anexo 11/2023")
    apply(a24, "Anexo 01/2024")

    rows = []
    for c in sorted(catalog):
        r = catalog[c]
        src = " + ".join(sources[c])
        note = f"Migrado de: {src}."
        if r["units"] is None:
            note += " Sin U.B. en el nomenclador."
        nm = r["name"]
        needs_review = (nm.count("(") != nm.count(")") or len(nm) > 90
                        or len(nm) < 3 or "D E T E" in nm)
        rows.append({
            "nbuCode": c,
            "name": nm,
            "units": (str(r["units"].quantize(Decimal("0.01")))
                      if r["units"] is not None else None),
            "section": r["section"],
            "active": r["active"],
            "isSpecialAct": c in ("660001", "001"),
            "sourcePage": r["page"],
            "needsReview": needs_review,
            "notes": note,
        })

    summary = {
        "total": len(rows),
        "withoutUB": sum(1 for r in rows if r["units"] is None),
        "needsReview": sum(1 for r in rows if r["needsReview"]),
        "inactive": sum(1 for r in rows if not r["active"]),
        "bySection": {},
        "rawBase": len(base),
        "rawAnexo2023": len(a23),
        "rawAnexo2024": len(a24),
    }
    for r in rows:
        summary["bySection"][r["section"]] = \
            summary["bySection"].get(r["section"], 0) + 1

    with open("nbu-dataset.json", "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "practices": rows}, f,
                  ensure_ascii=False, indent=2)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
