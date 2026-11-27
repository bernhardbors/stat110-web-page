# STAT110 · Eksamensøving

Øvingsside for STAT110 Grunnkurs i statistikk (UiB), eksamen 7. desember 2026.
Prøveeksamener, tidligere eksamener og temasett med automatisk retting av flervalg (med minuspoeng som i Inspera), selvretting av langsvar etter poengmal, formelark og tabeller, og en studieradar som viser hva du bør øve mer på.

Statisk side uten byggesteg i nettleseren. Den publiseres med GitHub Pages fra `main`.

## Struktur

| Mappe/fil | Innhold |
|---|---|
| `index.html`, `eksamen.html`, `formelark.html` | Sidene |
| `js/` | `common.js` (markdown, KaTeX, lagring, poeng), `exam.js` (eksamensmotor), `home.js`, `formelark.js` |
| `content/*.yaml` | **Oppgavene** – ett sett per fil. Det er her innhold redigeres. |
| `data/exams/*.json` | Generert fra `content/` av `tools/build.py` (ikke rediger for hånd) |
| `data/tables.json` | Tabeller A.1–A.6, generert av `tools/make_tables.py` (scipy) |
| `img/` | Figurer, generert av `tools/make_figures.py` |
| `vendor/katex/` | KaTeX 0.16 (MIT-lisens) |

## Legge til eller endre oppgaver

1. Rediger eller lag `content/<id>.yaml`. Se `content/v26.yaml` for formatet. Tekst skrives i enkel markdown med matte i `$...$` og `$$...$$`.
2. Kjør `python3 tools/build.py`. Skriptet validerer (poengsum i poengmal, riktige alternativ, temaer, bilder) og skriver JSON.
3. Test lokalt med `python3 -m http.server` og åpne <http://localhost:8000>.

Oppgavetyper:

- `langsvar`: `prompt`, `solution`, `rubric` (liste med `[poeng, tekst]` som summerer til `points`)
- `flervalg`: `prompt` og `options` (`text`, `correct`, `why`). Poeng: hvert riktig kryss gir `points/antall_riktige`, hvert feil kryss trekker like mye, og laveste sum er 0.

Temaer (`topics`) er definert i `data/topics.json` og brukes av studieradaren.

## Kilder

Oppgavetekstene fra tidligere eksamener tilhører UiB. Løsningsforslagene er våre egne. Dette er ikke en offisiell UiB-side.
