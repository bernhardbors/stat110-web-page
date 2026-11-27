"""Bygger data/exams/*.json og data/exams/index.json fra content/*.yaml og validerer innholdet.
Kjør: python3 tools/build.py"""
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content"
OUT = ROOT / "data" / "exams"
OUT.mkdir(parents=True, exist_ok=True)

TOPICS = {t["id"] for t in json.loads((ROOT / "data" / "topics.json").read_text())}
KIND_LABEL = {"tidligere": "Tidligere eksamen", "prove": "Prøveeksamen", "temasett": "Temasett"}
KIND_ORDER = {"prove": 0, "tidligere": 1, "temasett": 2}

errors = []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def check_text(where, s):
    if s is None:
        return
    if s.count("$$") % 2:
        err(where, "ulikt antall $$")
    single = re.sub(r"\$\$", "", s).count("$")
    if single % 2:
        err(where, "ulikt antall $ (uavsluttet matte?)")
    for m in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", s):
        if not (ROOT / m.group(1)).exists():
            err(where, f"bildet finnes ikke: {m.group(1)}")


index = []
exam_tasks = {}
warnings = []
for path in sorted(SRC.glob("*.yaml")):
    d = yaml.safe_load(path.read_text())
    eid = d["id"]
    where = path.name
    if path.stem != eid:
        err(where, f"id ({eid}) skal være lik filnavnet")
    kind = d.get("kind")
    if kind not in KIND_LABEL:
        err(where, f"ukjent kind {kind}")
    d["kindLabel"] = KIND_LABEL.get(kind, "")
    d.setdefault("duration_min", 240)
    check_text(where + " note", d.get("note"))
    ids = set()
    total = 0
    topics_used = []
    n = 0
    for s in d["sections"]:
        check_text(f"{where} {s['title']} intro", s.get("intro"))
        for t in s["tasks"]:
            n += 1
            tid = str(t["id"])
            t["id"] = tid
            w = f"{where} oppg {tid}"
            if tid in ids:
                err(w, "duplikat id")
            ids.add(tid)
            if t.get("type") not in ("langsvar", "flervalg"):
                err(w, "type må være langsvar eller flervalg")
            if not isinstance(t.get("points"), (int, float)) or t["points"] <= 0:
                err(w, "mangler poeng")
            total += t.get("points", 0)
            for tp in t.get("topics", []):
                if tp not in TOPICS:
                    err(w, f"ukjent tema {tp}")
                topics_used.append(tp)
            if not t.get("topics"):
                err(w, "mangler topics")
            check_text(w + " prompt", t.get("prompt"))
            check_text(w + " solution", t.get("solution"))
            if t["type"] == "flervalg":
                opts = t.get("options") or []
                if len(opts) < 2:
                    err(w, "flervalg trenger minst 2 alternativ")
                if not any(o.get("correct") for o in opts):
                    err(w, "ingen riktige alternativ")
                for k, o in enumerate(opts):
                    o["correct"] = bool(o.get("correct"))
                    check_text(f"{w} alt {k + 1}", o.get("text"))
                    check_text(f"{w} alt {k + 1} why", o.get("why"))
            else:
                if not t.get("solution"):
                    err(w, "langsvar mangler løsningsforslag")
                rub = t.get("rubric") or []
                rs = sum(r[0] for r in rub)
                if rub and abs(rs - t["points"]) > 1e-9:
                    err(w, f"poengmalen summerer til {rs}, ikke {t['points']}")
                for k, r in enumerate(rub):
                    check_text(f"{w} rubric {k + 1}", r[1])
            if "label" not in t:
                m = re.match(r"^(\d+)([a-z]?)$", tid)
                t["label"] = f"{m.group(1)}({m.group(2)})" if m and m.group(2) else tid
    exam_tasks[eid] = {
        "short": d.get("short", eid.upper()),
        "tasks": {str(t["id"]): t.get("label", t["id"]) for sec in d["sections"] for t in sec["tasks"]},
    }
    d["totalPoints"] = round(total, 2)
    (OUT / f"{eid}.json").write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
    index.append(
        {
            "id": eid,
            "title": d["title"],
            "short": d.get("short", eid.upper()),
            "kind": kind,
            "order": d.get("order", 0),
            "blurb": d.get("blurb", ""),
            "featured": d.get("featured", ""),
            "totalPoints": d["totalPoints"],
            "duration_min": d["duration_min"],
            "nTasks": n,
            "topics": sorted(set(topics_used), key=topics_used.index),
        }
    )

# ---------- Manual ----------
man_path = ROOT / "content" / "manual" / "manual.yaml"
if man_path.exists():
    man = yaml.safe_load(man_path.read_text())
    man.setdefault("parts", [])
    for part_file in sorted((ROOT / "content" / "manual").glob("[0-9]*.yaml")):
        pdata = yaml.safe_load(part_file.read_text())
        man["parts"].extend(pdata["parts"])
    check_text("manual intro", man.get("intro"))
    seen = set()
    n_sec = 0
    for part in man["parts"]:
        check_text(f"manual del {part['title']}", part.get("intro"))
        for sec in part["sections"]:
            n_sec += 1
            w = f"manual {sec.get('id')}"
            if not sec.get("id") or sec["id"] in seen:
                err(w, "mangler eller duplikat id")
            seen.add(sec["id"])
            for tp in sec.get("topics", []):
                if tp not in TOPICS:
                    err(w, f"ukjent tema {tp}")
            check_text(w, sec.get("body"))
            if sec.get("body", "").count("\n:::") and sec["body"].count(":::") % 2:
                err(w, "uavsluttet callout (:::)")
            resolved = []
            for ref in sec.get("practice", []):
                ex, _, tid = str(ref).partition(":")
                if ex in exam_tasks and tid in exam_tasks[ex]["tasks"]:
                    resolved.append({"exam": ex, "task": tid, "label": f"{exam_tasks[ex]['short']} {exam_tasks[ex]['tasks'][tid]}"})
                else:
                    warnings.append(f"{w}: oppgavereferanse {ref} finnes ikke (ennå), hoppes over")
            sec["practice"] = resolved
    # temaer -> manualseksjon (første seksjon som har temaet som hovedtema)
    (ROOT / "data" / "manual.json").write_text(json.dumps(man, ensure_ascii=False, separators=(",", ":")))
    topic_ids = [t["id"] for t in json.loads((ROOT / "data" / "topics.json").read_text())]
    print(f"Manual: {len(man['parts'])} deler, {n_sec} seksjoner")
    for t in json.loads((ROOT / "data" / "topics.json").read_text()):
        if t.get("manual") and t["manual"] not in seen:
            err("topics.json", f"tema {t['id']} peker til ukjent manualseksjon {t['manual']}")

index.sort(key=lambda e: (KIND_ORDER.get(e["kind"], 9), e["order"], e["id"]))
(OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))

# Fjern JSON for sett som ikke lenger har kilde
for f in OUT.glob("*.json"):
    if f.name != "index.json" and not (SRC / f"{f.stem}.yaml").exists():
        f.unlink()

for w_ in warnings:
    print("Advarsel:", w_)
if errors:
    print("FEIL:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print(f"OK: {len(index)} sett bygget")
for e in index:
    print(f"  {e['id']:<14} {e['kind']:<10} {e['totalPoints']:>5} p  {e['nTasks']:>2} oppg")
