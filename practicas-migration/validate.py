"""
Integrity validation: independently re-reads the U.B. token sitting on the
EXACT Y of each code in the source PDFs and compares it to the dataset.
This proves no U.B. was bound to the wrong code (the critical risk).
"""
import json
import re
import sys
from decimal import Decimal

import fitz

sys.stdout.reconfigure(encoding="utf-8")
CODE_RE = re.compile(r"^\d{6}$")
UB_RE = re.compile(r"^\d{1,5}(?:[.,]\d{1,2})?$")

DS = json.load(open("nbu-dataset.json", encoding="utf-8"))["practices"]
BY = {r["nbuCode"]: r for r in DS}


def ub_on_code_row(path, ub_left):
    """code -> Decimal|None|'MISSING', read strictly on the code's own Y."""
    res = {}
    doc = fitz.open(path)
    for pi in range(len(doc)):
        ws = doc[pi].get_text("words")
        codes = [(w[4], w[1]) for w in ws
                 if w[0] < 60 and CODE_RE.match(w[4])]
        for code, cy in codes:
            val = "MISSING"
            for x0, y0, _x1, _y1, t, *_ in ws:
                if x0 >= ub_left and abs(y0 - cy) <= 3.0:
                    if t == "-":
                        val = None
                    elif UB_RE.match(t):
                        val = Decimal(t.replace(",", "."))
                    break
            res.setdefault(code, val)
    return res


base = ub_on_code_row("NBU-Version-2012-Act.-2016.pdf", 515)
a24 = ub_on_code_row("Anexo-01.2024-NBU-2012.pdf", 470)
a23 = ub_on_code_row("Anexo-11.2023-NBU-2012-16-Final.pdf", 470)

mism, checked, override_ok = [], 0, 0
for code, r in BY.items():
    # expected = newest source that defined a UB (2024 > 2023 > base)
    exp = "MISSING"
    for src in (base, a23, a24):
        if code in src and src[code] != "MISSING" and src[code] is not None:
            exp = src[code]
    ds_val = Decimal(r["units"]) if r["units"] is not None else None
    if exp == "MISSING":
        continue
    checked += 1
    if ds_val != exp:
        mism.append((code, str(exp), r["units"], r["name"][:40]))
    if code in a24 and a24[code] not in ("MISSING", None) \
            and code in base and base[code] not in ("MISSING", None) \
            and a24[code] != base[code]:
        if ds_val == a24[code]:
            override_ok += 1

print(f"codes with a UB cross-checked: {checked}")
print(f"UB mismatches (dataset vs PDF code-row): {len(mism)}")
for m in mism[:25]:
    print("  ", m)
print(f"annex-2024 UB overrides correctly applied: {override_ok}")

# coverage: every 6-digit code that appears in any source price list present?
src_codes = set(base) | set(a23) | set(a24)
missing = sorted(src_codes - set(BY))
print(f"source price-list codes: {len(src_codes)}  in dataset: {len(BY)}  "
      f"missing: {len(missing)}")
print("  sample missing:", missing[:15])
