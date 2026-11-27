"""Lager figurer til oppgavene (egne simuleringer, ikke kopier av eksamensfigurene).
Kjør: python3 tools/make_figures.py"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "img"
IMG.mkdir(exist_ok=True)

plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})


def v26_maxwell():
    """Figur 1 i V26 oppg. 2: histogram og normalplott av 10000 Maxwell–Boltzmann-observasjoner, før og etter log."""
    rng = np.random.default_rng(110)
    a = 100.0
    # Maxwell–Boltzmann = lengden av en 3D-vektor med uavhengige N(0, a^2)-komponenter
    x = np.linalg.norm(rng.normal(0, a, size=(10000, 3)), axis=1)
    lx = np.log(x)
    fig, ax = plt.subplots(2, 2, figsize=(7.2, 6.0))
    for j, (d, title, xlab) in enumerate([(x, "Data", "x"), (lx, "ln(Data)", "ln(x)")]):
        ax[0, j].hist(d, bins=30, density=True, color="#c9cdd4", edgecolor="#333", linewidth=0.6)
        ax[0, j].set_title(title, fontweight="bold")
        ax[0, j].set_xlabel(xlab)
        ax[0, j].set_ylabel("Tetthet")
        (osm, osr), (slope, intercept, _) = stats.probplot(d, dist="norm")
        ax[1, j].plot(osm, osr, "o", ms=2.5, mfc="none", mec="#222", mew=0.6)
        q1, q3 = np.percentile(d, [25, 75])
        z1, z3 = stats.norm.ppf([0.25, 0.75])
        s = (q3 - q1) / (z3 - z1)
        xs = np.array([-4, 4])
        ax[1, j].plot(xs, q1 + s * (xs - z1), color="#d62728", lw=1.6)
        ax[1, j].set_title("Normalplott" + (" ln(Data)" if j else ""), fontweight="bold")
        ax[1, j].set_xlabel("Teoretiske kvantiler")
        ax[1, j].set_ylabel("Empiriske kvantiler")
    fig.tight_layout()
    fig.savefig(IMG / "v26-maxwell.png", dpi=150)
    plt.close(fig)


def v26_poisson_svg():
    """Figur i V26 4(d): en realisasjon av en Poissonprosess langs en linje."""
    pts = [0.62, 1.12, 1.22, 2.0, 2.55]
    W, H = 640, 190
    x0, x1 = 40, 600
    sx = lambda t: x0 + (x1 - x0) * t / 3.2
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Georgia, serif" font-size="15">']
    # farget stav (klippet til avrundet form)
    parts.append(f'<defs><clipPath id="stav"><rect x="{x0}" y="20" width="{x1 - x0}" height="40" rx="20"/></clipPath></defs><g clip-path="url(#stav)">')
    edges = [0] + pts + [3.2]
    cols = ["#2f6db5", "#c8312d"]
    for k in range(len(edges) - 1):
        parts.append(f'<rect x="{sx(edges[k]):.1f}" y="20" width="{sx(edges[k+1]) - sx(edges[k]):.1f}" height="40" fill="{cols[k % 2]}"/>')
    parts.append("</g>")
    parts.append(f'<rect x="{x0}" y="20" width="{x1 - x0}" height="40" rx="20" fill="none" stroke="#222" stroke-width="2"/>')
    # tidsakse
    ya = 140
    parts.append(f'<line x1="{x0}" y1="{ya}" x2="{x1 + 10}" y2="{ya}" stroke="#222" stroke-width="1.5"/>')
    parts.append(f'<polygon points="{x1 + 18},{ya} {x1 + 8},{ya - 5} {x1 + 8},{ya + 5}" fill="#222"/>')
    for t in [0, 1, 2]:
        parts.append(f'<line x1="{sx(t):.1f}" y1="{ya - 6}" x2="{sx(t):.1f}" y2="{ya + 6}" stroke="#222"/>')
        parts.append(f'<text x="{sx(t):.1f}" y="{ya + 26}" text-anchor="middle">{t}</text>')
    parts.append(f'<text x="{x1 - 10}" y="{ya + 26}" text-anchor="end" font-style="italic">t (avstand)</text>')
    for p in pts:
        parts.append(f'<circle cx="{sx(p):.1f}" cy="{ya}" r="5" fill="#111"/>')
    # klammer for T1..T4
    prev = 0
    for k, p in enumerate(pts[:4]):
        a, b = sx(prev) + 2, sx(p) - 2
        m = (a + b) / 2
        yb = 100
        parts.append(f'<path d="M{a:.1f},{yb + 10} Q{a:.1f},{yb} {a + 6:.1f},{yb} L{m - 4:.1f},{yb} L{m:.1f},{yb - 6} L{m + 4:.1f},{yb} L{b - 6:.1f},{yb} Q{b:.1f},{yb} {b:.1f},{yb + 10}" fill="none" stroke="#d9822b" stroke-width="1.6"/>')
        parts.append(f'<text x="{m:.1f}" y="{yb - 12}" text-anchor="middle" font-style="italic">T<tspan baseline-shift="sub" font-size="11">{k + 1}</tspan></text>')
        prev = p
    parts.append("</svg>")
    (IMG / "v26-poisson.svg").write_text("\n".join(parts))


if __name__ == "__main__":
    v26_maxwell()
    v26_poisson_svg()
    print("Figurer skrevet til img/")
