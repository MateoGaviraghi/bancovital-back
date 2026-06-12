"""
GATE de garantía. Se corre después de extract.py.

Hace 3 verificaciones independientes y MARCA needsReview en el dataset:

  1. U.B. triangulada: extract.py (umbral X) vs lógica estructural
     (numérico a la izq. del marcador PMO/PE). Deben coincidir las 1445.
     -> si hay 1 sola discrepancia, exit 1 (falla dura).
  2. Cobertura: todo código 6-díg de toda página de precios de los 3 PDF
     está en el dataset. -> faltante => exit 1.
  3. Nombres: segundo motor PDF (Poppler/pdftotext) vs el nuestro
     (PyMuPDF). Los que no coinciden NO son falla dura (suelen ser
     sinónimos) pero se marcan needsReview para revisión humana.

Reescribe nbu-dataset.json con needsReview actualizado. Exit 0 solo si
las garantías duras (1 y 2) pasan.
"""
import json
import os
import re
import subprocess
import sys
import unicodedata
from decimal import Decimal
from pathlib import Path

import fitz

sys.stdout.reconfigure(encoding="utf-8")
os.chdir(Path(__file__).parent)  # ejecutable desde cualquier cwd

CODE_RE = re.compile(r"^\d{6}$")
NUM_RE = re.compile(r"^\d{1,5},\d{1,2}$")
FREQ = {"PMO", "PE"}
PDFS = [
    ("NBU-Version-2012-Act.-2016.pdf", False),
    ("Anexo-11.2023-NBU-2012-16-Final.pdf", True),
    ("Anexo-01.2024-NBU-2012.pdf", True),
]


def structural_ub(path, annex):
    """U.B. por regla estructural (independiente del umbral X de extract.py)."""
    out = {}
    doc = fitz.open(path)
    for pi in range(len(doc)):
        ws = doc[pi].get_text("words")
        for code, cy in [(w[4], w[1]) for w in ws
                         if w[0] < 60 and CODE_RE.match(w[4])]:
            row = sorted([w for w in ws if abs(w[1] - cy) <= 3.0 and w[0] > 60],
                         key=lambda w: w[0])
            toks = [(w[0], w[4]) for w in row]
            ub = "MISS"
            if annex:
                fx = next((x for x, t in toks if t in FREQ), None)
                nums = [t for x, t in toks
                        if NUM_RE.match(t) and (fx is None or x < fx)]
                ub = (Decimal(nums[-1].replace(",", ".")) if nums
                      else (None if any(t == "-" for _, t in toks) else "MISS"))
            else:
                nums = [t for _, t in toks if NUM_RE.match(t)]
                ub = (Decimal(nums[-1].replace(",", ".")) if nums
                      else (None if any(t == "-" for _, t in toks) else "MISS"))
            out.setdefault(code, ub)
    return out


def skel(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", s.lower())


def poppler_names():
    names = {}
    for path, _ in PDFS:
        txt = subprocess.run(["pdftotext", "-layout", "-enc", "UTF-8", path, "-"],
                              capture_output=True).stdout.decode("utf-8", "replace")
        for ln in txt.splitlines():
            m = re.match(r"\s*(\d{6})\s+(.+)", ln)
            if m:
                code = m.group(1)
                rest = re.split(r"\s{2,}", m.group(2))[0]
                if len(rest) > len(names.get(code, "")):
                    names[code] = rest
    return names


def main():
    data = json.load(open("nbu-dataset.json", encoding="utf-8"))
    rows = data["practices"]
    ds = {r["nbuCode"]: r for r in rows}

    # ---- 1. U.B. triangulada -------------------------------------------
    srcs = [structural_ub(p, a) for p, a in PDFS]
    indep = {}
    for s in srcs:
        for c, v in s.items():
            indep.setdefault(c, v)
            if v != "MISS" and v is not None:
                indep[c] = v
    ub_disagree = []
    for c, r in ds.items():
        dv = Decimal(r["units"]) if r["units"] is not None else None
        iv = indep.get(c, "ABSENT")
        if iv == "MISS":
            iv = None
        if iv != "ABSENT" and dv != iv:
            ub_disagree.append((c, str(dv), str(iv)))

    # ---- 2. Cobertura --------------------------------------------------
    src_codes = set()
    for s in srcs:
        src_codes |= set(s)
    missing = sorted(src_codes - set(ds))

    # ---- 3. Nombres (motor independiente) ------------------------------
    pop = poppler_names()
    name_review = []
    for c, r in ds.items():
        pv = pop.get(c)
        if not pv:
            continue
        a, b = skel(r["name"]), skel(pv)
        if not a or not b:
            continue
        short, long = sorted([a, b], key=len)
        ok = short in long or (
            sum(1 for ch in set(short) if ch in long) / max(1, len(set(short)))
            > 0.9 and abs(len(a) - len(b)) <= max(8, int(0.25 * len(short))))
        if not ok:
            name_review.append(c)

    # ---- marcar needsReview = heurística ∪ nombre-discrepa ∪ ub-discrepa
    nr = set(name_review) | {c for c, *_ in ub_disagree}
    for r in rows:
        r["needsReview"] = bool(r.get("needsReview")) or r["nbuCode"] in nr
    data["summary"]["needsReview"] = sum(1 for r in rows if r["needsReview"])
    data["summary"]["ubTriangulated"] = len(ds) - len(ub_disagree)
    data["summary"]["nameReviewCount"] = len(name_review)
    json.dump(data, open("nbu-dataset.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    # ---- reporte + exit ------------------------------------------------
    print(f"1) U.B. triangulada : {len(ds) - len(ub_disagree)}/{len(ds)} "
          f"coinciden | discrepancias: {len(ub_disagree)}")
    for d in ub_disagree[:20]:
        print("   XX", *d)
    print(f"2) Cobertura        : {len(ds)} dataset / {len(src_codes)} "
          f"en PDFs | faltantes: {len(missing)} {missing[:10]}")
    print(f"3) Nombres (Poppler): {len(ds) - len(name_review)} ok | "
          f"a revisar: {len(name_review)} (marcados needsReview)")
    print(f"   needsReview total en dataset: "
          f"{data['summary']['needsReview']}")

    hard_ok = not ub_disagree and not missing
    print("RESULTADO:", "GARANTIZADO (U.B.+cobertura)" if hard_ok
          else "FALLA DURA")
    sys.exit(0 if hard_ok else 1)


if __name__ == "__main__":
    main()
