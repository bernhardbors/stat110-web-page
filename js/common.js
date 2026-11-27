// Felles hjelpefunksjoner: lasting av data, mini-markdown, KaTeX, lagring og poengberegning.

export const EXAM_DATE = new Date("2026-12-07T09:00:00+01:00");

export async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Kunne ikke laste ${path} (${res.status})`);
  return res.json();
}

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------- Mini-markdown med matte ----------
// Støtter: avsnitt, **fet**, *kursiv*, `kode`, lister (- og 1.), tabeller (|a|b|), bilder ![alt](src),
// lenker [tekst](url), overskrifter (###) og rå HTML-blokker. Matte i $...$ og $$...$$ beskyttes.

function inline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => `<a href="${href}" target="_blank" rel="noopener">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function table(lines) {
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const head = cells(lines[0]);
  const body = lines.slice(lines[1] && /^\s*\|?\s*:?-+/.test(lines[1]) ? 2 : 1);
  return (
    '<div class="table-wrap"><table class="md"><thead><tr>' +
    head.map((h) => `<th>${inline(h)}</th>`).join("") +
    "</tr></thead><tbody>" +
    body.map((l) => "<tr>" + cells(l).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
    "</tbody></table></div>"
  );
}

export function md(src) {
  if (src == null || src === "") return "";
  const math = [];
  const keep = (m) => {
    math.push(m);
    return `\u0000${math.length - 1}\u0000`;
  };
  let s = String(src)
    .replace(/\$\$([\s\S]+?)\$\$/g, keep)
    .replace(/\$([^$\n]+?)\$/g, keep);

  const blocks = s.trim().split(/\n[ \t]*\n/);
  const html = blocks
    .map((b) => {
      const lines = b.split("\n");
      const first = lines[0];
      if (/^\s*</.test(first)) return b;
      if (/^\s*\|/.test(first)) return table(lines);
      const h = first.match(/^(#{2,4})\s+(.*)$/);
      if (h && lines.length === 1) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      if (/^\s*[-*]\s+/.test(first) || /^\s*\d+[.)]\s+/.test(first)) {
        const ordered = /^\s*\d+[.)]\s+/.test(first);
        const items = [];
        for (const l of lines) {
          if (/^\s*([-*]|\d+[.)])\s+/.test(l)) items.push(l.replace(/^\s*([-*]|\d+[.)])\s+/, ""));
          else if (items.length) items[items.length - 1] += " " + l.trim();
        }
        const tag = ordered ? "ol" : "ul";
        return `<${tag}>` + items.map((i) => `<li>${inline(i)}</li>`).join("") + `</${tag}>`;
      }
      return `<p>${inline(lines.join(" "))}</p>`;
    })
    .join("\n");
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => esc(math[+i]));
}

export function typeset(el) {
  const run = () =>
    window.renderMathInElement &&
    window.renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  if (window.renderMathInElement) run();
  else window.addEventListener("load", run, { once: true });
}

// ---------- Lagring (localStorage) ----------
const RUNS_KEY = "stat110.runs.v1";
const ACTIVE_PREFIX = "stat110.active.v1.";

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* privat modus o.l. – ignorer */
  }
}

export const store = {
  runs: () => read(RUNS_KEY, []),
  saveRun(run) {
    const runs = read(RUNS_KEY, []).filter((r) => r.id !== run.id);
    runs.push(run);
    write(RUNS_KEY, runs);
  },
  deleteRun(id) {
    write(RUNS_KEY, read(RUNS_KEY, []).filter((r) => r.id !== id));
  },
  clearRuns() {
    write(RUNS_KEY, []);
  },
  active: (examId) => read(ACTIVE_PREFIX + examId, null),
  setActive: (examId, state) => write(ACTIVE_PREFIX + examId, state),
  clearActive: (examId) => {
    try {
      localStorage.removeItem(ACTIVE_PREFIX + examId);
    } catch {}
  },
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Poeng ----------
// Flervalg (flere svar) som i Inspera: hvert riktig kryss gir poeng/antall_riktige,
// hvert feil kryss trekker like mye, og oppgaven gir aldri under 0.
export function scoreFlervalg(task, selected) {
  const nCorrect = task.options.filter((o) => o.correct).length || 1;
  const per = task.points / nCorrect;
  let raw = 0;
  task.options.forEach((o, i) => {
    if (selected.includes(i)) raw += o.correct ? per : -per;
  });
  return Math.max(0, round2(raw));
}

export function round2(x) {
  return Math.round(x * 100) / 100;
}

export function fmtP(x) {
  const v = round2(x);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "").replace(".", ",");
}

export function pct(a, b) {
  return b ? Math.round((100 * a) / b) : 0;
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} t ${m % 60} min`;
}

export function allTasks(exam) {
  return exam.sections.flatMap((s, si) => s.tasks.map((t) => ({ ...t, _section: si })));
}
