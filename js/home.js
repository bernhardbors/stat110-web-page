import { getJSON, md, typeset, store, fmtP, pct, fmtDate, fmtDuration, esc, EXAM_DATE, round2 } from "./common.js";

const $ = (s) => document.querySelector(s);

init().catch((e) => {
  $("#main").insertAdjacentHTML("afterbegin", `<div class="card error">Kunne ikke laste innhold: ${esc(e.message)}</div>`);
});

async function init() {
  const [index, topics] = await Promise.all([getJSON("data/exams/index.json"), getJSON("data/topics.json")]);
  countdown();
  setInterval(countdown, 60000);
  const runs = store.runs();
  const feat = index.filter((e) => e.featured);
  $("#featured").innerHTML = feat
    .map(
      (e) => `<a class="featured" href="eksamen.html?id=${e.id}&modus=ovelse"><span class="feat-tag">${esc(e.featured)}</span><b>${esc(e.title)}</b><span>${md(e.blurb).replace(/^<p>|<\/p>$/g, "")}</span><span class="go">Start →</span></a>`
    )
    .join("");
  renderList("#prove", index.filter((e) => e.kind === "prove"), runs, "Prøveeksamenene kommer snart.");
  renderList("#tidligere", index.filter((e) => e.kind === "tidligere"), runs, "Ingen ennå.");
  renderList("#temasett", index.filter((e) => e.kind === "temasett"), runs, "Temasettene kommer snart.");
  renderRuns(runs, index);
  renderRadar(runs, topics, index);
  typeset(document.body);
}

function countdown() {
  const ms = EXAM_DATE - Date.now();
  const el = $("#countdown");
  if (!el) return;
  if (ms <= 0) {
    el.textContent = "Lykke til på eksamen!";
    return;
  }
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  el.innerHTML = `<b>${d}</b> dager og <b>${h}</b> timer til eksamen`;
}

function best(runs, id) {
  const rs = runs.filter((r) => r.examId === id);
  if (!rs.length) return null;
  const scores = rs.map((r) => {
    const t = Object.values(r.tasks);
    return pct(t.reduce((s, x) => s + x.score, 0), t.reduce((s, x) => s + x.max, 0));
  });
  return { n: rs.length, best: Math.max(...scores) };
}

function renderList(sel, items, runs, empty) {
  const el = $(sel);
  if (!items.length) {
    el.innerHTML = `<p class="muted">${empty}</p>`;
    return;
  }
  el.innerHTML = items
    .map((e) => {
      const b = best(runs, e.id);
      return `<article class="exam-card">
        <div class="exam-card-top">
          <h3>${esc(e.title)}</h3>
          ${b ? `<span class="badge" title="${b.n} forsøk">Beste: ${b.best} %</span>` : ""}
        </div>
        ${e.blurb ? `<p class="blurb">${md(e.blurb).replace(/^<p>|<\/p>$/g, "")}</p>` : ""}
        <p class="meta">${e.totalPoints} poeng · ${e.nTasks} oppgaver${e.kind !== "temasett" ? ` · ${e.duration_min / 60} t` : ""}</p>
        <div class="btns">
          ${e.kind === "temasett" ? "" : `<a class="btn primary" href="eksamen.html?id=${e.id}&modus=eksamen">Eksamen</a>`}
          <a class="btn ${e.kind === "temasett" ? "primary" : ""}" href="eksamen.html?id=${e.id}&modus=ovelse">Øving</a>
        </div>
      </article>`;
    })
    .join("");
}

function renderRuns(runs, index) {
  const el = $("#runs");
  if (!runs.length) {
    el.innerHTML = `<p class="muted">Ingen forsøk ennå. Fullførte forsøk lagres i denne nettleseren.</p>`;
    return;
  }
  const rows = [...runs]
    .sort((a, b) => b.finishedAt - a.finishedAt)
    .map((r) => {
      const t = Object.values(r.tasks);
      const a = round2(t.reduce((s, x) => s + x.score, 0));
      const m = t.reduce((s, x) => s + x.max, 0);
      const un = t.filter((x) => !x.assessed).length;
      return `<tr>
        <td>${fmtDate(r.finishedAt)}</td>
        <td><a href="eksamen.html?id=${r.examId}&run=${r.id}">${esc(r.short || r.examTitle)}</a></td>
        <td>${r.mode === "eksamen" ? "Eksamen" : "Øving"}</td>
        <td>${fmtDuration(r.finishedAt - r.startedAt)}</td>
        <td><b>${fmtP(a)}</b> / ${fmtP(m)} (${pct(a, m)} %)${un ? ` <span class="chip warn" title="Langsvar som ikke er rettet">${un} urettet</span>` : ""}</td>
        <td><button class="link del" data-id="${r.id}" title="Slett forsøket">Slett</button></td>
      </tr>`;
    })
    .join("");
  el.innerHTML = `<div class="table-wrap"><table class="runs"><thead><tr><th>Dato</th><th>Sett</th><th>Modus</th><th>Tid</th><th>Poeng</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  el.querySelectorAll(".del").forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm("Slette dette forsøket?")) {
          store.deleteRun(b.dataset.id);
          location.reload();
        }
      })
  );
}

function renderRadar(runs, topics, index) {
  const el = $("#radar");
  const agg = {};
  for (const r of runs)
    for (const t of Object.values(r.tasks)) {
      if (!t.assessed) continue;
      for (const tp of t.topics || []) {
        agg[tp] ??= { s: 0, m: 0, n: 0 };
        agg[tp].s += t.score / (t.topics.length || 1);
        agg[tp].m += t.max / (t.topics.length || 1);
        agg[tp].n++;
      }
    }
  const rows = topics.map((tp) => {
    const a = agg[tp.id];
    const p = a ? pct(a.s, a.m) : null;
    // Prioritet: høy eksamensfrekvens og lav score først; uøvd tema regnes som 40 %
    const prio = (tp.freq || 1) * (100 - (p ?? 40));
    return { ...tp, p, n: a?.n || 0, prio };
  });
  rows.sort((a, b) => b.prio - a.prio);
  const practiced = rows.filter((r) => r.p !== null).length;
  const sets = index.filter((e) => e.kind === "temasett");
  el.innerHTML = `
    <p class="muted">${
      practiced
        ? `Basert på ${runs.length} forsøk. Sortert etter hva som lønner seg mest å øve på: temaer som ofte kommer på eksamen og der du scorer lavt, står øverst.`
        : "Fullfør et forsøk, så fylles radaren ut. Til da er temaene sortert etter hvor ofte de har kommet på eksamen."
    }</p>
    <div class="radar">${rows
      .map((r) => {
        const set = sets.find((s) => (s.topics || []).includes(r.id));
        return `<div class="radar-row ${r.p === null ? "unseen" : r.p < 50 ? "low" : r.p < 75 ? "mid" : "high"}">
          <div class="radar-name">${esc(r.name)}<span class="freq" title="Antall av de sju siste eksamenene der temaet var med">${"●".repeat(r.freq)}${"○".repeat(7 - r.freq)}</span></div>
          <div class="radar-bar"><span style="width:${r.p ?? 0}%"></span></div>
          <div class="radar-val">${r.p === null ? "ikke øvd" : r.p + " %"}</div>
          <div class="radar-go">${set ? `<a href="eksamen.html?id=${set.id}&modus=ovelse">Øv →</a>` : ""}</div>
        </div>`;
      })
      .join("")}</div>`;
}
