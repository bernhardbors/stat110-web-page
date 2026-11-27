"""Lager data/tables.json: tabellene som ligger som vedlegg på eksamen (Devore A.1, A.2, A.3, A.5, A.6),
beregnet på nytt med scipy. Kjør: python3 tools/make_tables.py"""
import json
from pathlib import Path

import numpy as np
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent

def r(x, d):
    return float(f"{x:.{d}f}")

# A.1 Kumulative binomiske sannsynligheter B(x; n, p) = P(X <= x)
binom_p = [0.01, 0.05, 0.10, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60, 0.70, 0.75, 0.80, 0.90, 0.95, 0.99]
binom = []
for n in [5, 10, 15, 20, 25]:
    rows = []
    for x in range(n + 1):
        rows.append([r(stats.binom.cdf(x, n, p), 3) for p in binom_p])
    binom.append({"n": n, "rows": rows})

# A.2 Kumulative Poisson-sannsynligheter F(x; mu) = P(X <= x)
poisson_groups = [
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    [2, 3, 4, 5, 6, 7, 8, 9, 10],
    [15, 20],
]
poisson = []
for mus in poisson_groups:
    rows = []
    x = 0
    while True:
        vals = [r(stats.poisson.cdf(x, mu), 3) for mu in mus]
        rows.append({"x": x, "vals": vals})
        if all(v >= 1.0 for v in vals):
            break
        x += 1
    poisson.append({"mus": mus, "rows": rows})

# A.3 Standard normalfordeling Phi(z)
normal_rows = []
for i in range(-34, 35):
    z = i / 10
    cols = []
    for j in range(10):
        # Devore: for negative z går kolonnene mot mer negative verdier (z = -1.2 og kolonne .03 => -1.23)
        zz = z - j / 100 if (i < 0 or (i == 0 and False)) else z + j / 100
        cols.append(r(stats.norm.cdf(zz), 4))
    normal_rows.append({"z": f"{z:.1f}" if i != 0 else "0.0", "vals": cols})
# Rad "-0.0" (z fra -0.00 til -0.09) som i Devore
neg0 = {"z": "-0.0", "vals": [r(stats.norm.cdf(-j / 100), 4) for j in range(10)]}
idx0 = [k for k, row in enumerate(normal_rows) if row["z"] == "0.0"][0]
normal_rows.insert(idx0, neg0)

# A.5 Kritiske verdier t_{alpha, nu}
t_alphas = [0.10, 0.05, 0.025, 0.01, 0.005, 0.001, 0.0005]
t_nus = list(range(1, 31)) + [32, 34, 36, 38, 40, 50, 60, 120, "inf"]
t_rows = []
for nu in t_nus:
    if nu == "inf":
        vals = [r(stats.norm.ppf(1 - a), 3) for a in t_alphas]
    else:
        vals = [r(stats.t.ppf(1 - a, nu), 3) for a in t_alphas]
    t_rows.append({"nu": "∞" if nu == "inf" else nu, "vals": vals})

# A.6 Kritiske verdier chi^2_{alpha, nu} (areal alpha til høyre)
chi_alphas = [0.995, 0.99, 0.975, 0.95, 0.90, 0.10, 0.05, 0.025, 0.01, 0.005]
chi_rows = []
for nu in list(range(1, 41)):
    chi_rows.append({"nu": nu, "vals": [r(stats.chi2.ppf(1 - a, nu), 3) for a in chi_alphas]})

out = {
    "binomial": {"p": binom_p, "tables": binom},
    "poisson": poisson,
    "normal": {"cols": [f".0{j}" for j in range(10)], "rows": normal_rows},
    "t": {"alphas": t_alphas, "rows": t_rows},
    "chi2": {"alphas": chi_alphas, "rows": chi_rows},
}
(ROOT / "data").mkdir(exist_ok=True)
(ROOT / "data" / "tables.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print("Skrev data/tables.json")

# Kontroller noen kjente verdier fra eksamensløsningene
assert abs(stats.norm.cdf(1.56) - 0.9406) < 1e-4
assert round(stats.t.ppf(0.95, 3), 3) == 2.353
assert round(stats.poisson.cdf(18, 15), 3) == 0.819
assert round(stats.binom.cdf(3, 10, 0.3), 3) == 0.650
print("Kontroller OK")
