import { getJSON, md, typeset, store, uid, scoreFlervalg, fmtP, pct, round2, allTasks, esc, fmtDuration } from "./common.js";

const params = new URLSearchParams(location.search);
const examId = params.get("id");
const runParam = params.get("run");
const app = document.getElementById("app");
const bar = document.getElementById("exam-bar");

let exam, tasks, topics, state, timerHandle;

init().catch((e) => {
  app.innerHTML = `<div class="card error"><h2>Noe gikk galt</h2><p>${esc(e.message)}</p><p><a href="./">Til forsiden</a></p></div>`;
});

async function init() {
  if (!examId) throw new Error("Mangler eksamens-id i adressen.");
  [exam, topics] = await Promise.all([getJSON(`data/exams/${examId}.json`), getJSON("data/topics.json")]);
  tasks = allTasks(exam);
  document.title = `${exam.title} · STAT110`;

  if (runParam) {
    const run = store.runs().find((r) => r.id === runParam);
    if (!run) throw new Error("Fant ikke dette forsøket. Det er lagret i nettleseren du brukte.");
    state = { mode: run.mode, answers: run.answers || {}, runId: run.id, startedAt: run.startedAt };
    return showResults(run);
  }

  const active = store.active(examId);
  const wanted = params.get("modus");
  const oppg = params.get("oppg");
  if (oppg) {
    const idx = tasks.findIndex((t) => t.id === oppg);
    if (idx >= 0 && (!active || active.submitted)) {
      begin("ovelse", idx);
      return;
    }
    if (idx >= 0 && active?.mode === "ovelse") {
      state = active;
      showTask(idx);
      return;
    }
  }
  if (active && !active.submitted) return showStart(active);
  showStart(null, wanted);
}

// ---------- Startside ----------
function showStart(active, wanted) {
  bar.hidden = true;
  const nL = tasks.filter((t) => t.type === "langsvar");
  const nF = tasks.filter((t) => t.type === "flervalg");
  const sum = (a) => a.reduce((s, t) => s + t.points, 0);
  app.innerHTML = `
    <div class="start card">
      <p class="eyebrow">${esc(exam.kindLabel || "")}</p>
      <h1>${esc(exam.title)}</h1>
      ${exam.note ? `<div class="prose">${md(exam.note)}</div>` : ""}
      <ul class="facts">
        <li><b>${exam.totalPoints}</b> poeng</li>
        ${exam.kind === "temasett" ? "" : `<li><b>${exam.duration_min / 60}</b> timer</li>`}
        <li><b>${nL.length}</b> langsvar (${sum(nL)} p)</li>
        <li><b>${nF.length}</b> flervalg (${sum(nF)} p)</li>
      </ul>
      <div class="prose small">
        <p><strong>Langsvar:</strong> skriv i tekstfeltet eller på papir, slik som på eksamen. Etter levering ser du løsningsforslag og poengmal og retter deg selv.</p>
        <p><strong>Flervalg (flere svar):</strong> ett eller flere alternativ kan være riktige. Feil kryss gir minuspoeng, men aldri under 0 på oppgaven. Rettes automatisk.</p>
        <p>Formelsamling og tabeller åpner du med knappen <em>Formelark</em> øverst, som på Inspera.</p>
      </div>
      ${
        active
          ? `<div class="resume"><p>Du har et påbegynt forsøk i <b>${active.mode === "eksamen" ? "eksamensmodus" : "øvingsmodus"}</b>.</p>
             <div class="btns"><button class="btn primary" id="resume">Fortsett</button><button class="btn" id="discard">Forkast og start på nytt</button></div></div>`
          : `<div class="btns">
              ${exam.kind === "temasett" ? "" : `<button class="btn primary" data-mode="eksamen">Start eksamen · ${exam.duration_min / 60} t med tidtaker</button>`}
              <button class="btn ${exam.kind === "temasett" ? "primary" : ""}" data-mode="ovelse">${exam.kind === "temasett" ? "Start" : "Øvingsmodus"} · uten tid, sjekk svar underveis</button>
             </div>`
      }
      <p><a href="./">← Til forsiden</a></p>
    </div>`;
  typeset(app);
  if (active) {
    app.querySelector("#resume").onclick = () => {
      state = active;
      showTask(state.current || 0);
    };
    app.querySelector("#discard").onclick = () => {
      store.clearActive(examId);
      showStart(null);
    };
  } else {
    app.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => begin(b.dataset.mode)));
    if (wanted) app.querySelector(`[data-mode="${wanted}"]`)?.focus();
  }
}

function begin(mode, startAt = 0) {
  const now = Date.now();
  state = {
    mode,
    startedAt: now,
    deadline: mode === "eksamen" ? now + exam.duration_min * 60000 : null,
    answers: {},
    revealed: {},
    current: startAt,
  };
  save();
  showTask(startAt);
}

function save() {
  store.setActive(examId, state);
}

// ---------- Oppgavevisning ----------
function showTask(i) {
  state.current = i;
  save();
  renderBar();
  const t = tasks[i];
  const sec = exam.sections[t._section];
  const ans = state.answers[t.id] || {};
  const practice = state.mode === "ovelse";
  const revealed = state.revealed?.[t.id];

  app.innerHTML = `
    <div class="exam-layout">
      <nav class="task-nav" aria-label="Oppgaver">${navHtml(i)}</nav>
      <article class="task card">
        <p class="eyebrow">${esc(sec.title)}</p>
        ${sec.intro ? `<div class="section-intro prose">${md(sec.intro)}</div>` : ""}
        <header class="task-head">
          <h2>${esc(t.label || t.id)}</h2>
          <span class="tag ${t.type}">${t.type === "langsvar" ? "Langsvar" : t.single ? "Flervalg (ett svar)" : "Flervalg (flere svar)"} · ${fmtP(t.points)} p</span>
        </header>
        <div class="prose">${md(t.prompt)}</div>
        ${t.type === "flervalg" ? flervalgHtml(t, ans, practice && revealed) : langsvarHtml(t, ans)}
        <div class="practice-out">${practice && revealed ? feedbackHtml(t, ans) : ""}</div>
        <footer class="task-foot">
          <button class="btn" id="prev" ${i === 0 ? "disabled" : ""}>← Forrige</button>
          ${practice ? `<button class="btn accent" id="check">${t.type === "flervalg" ? "Sjekk svar" : "Vis løsningsforslag"}</button>` : ""}
          ${i < tasks.length - 1 ? `<button class="btn" id="next">Neste →</button>` : `<button class="btn primary" id="finish">${practice ? "Avslutt og se resultat" : "Lever"}</button>`}
        </footer>
      </article>
    </div>`;
  typeset(app);

  if (t.type === "flervalg") {
    app.querySelectorAll(".options input").forEach((cb) => {
      cb.onchange = () => {
        const sel = [...app.querySelectorAll(".options input:checked")].map((x) => +x.value);
        state.answers[t.id] = { sel };
        save();
        updateNav();
      };
    });
  } else {
    const ta = app.querySelector("textarea");
    let h;
    ta.oninput = () => {
      clearTimeout(h);
      h = setTimeout(() => {
        state.answers[t.id] = { text: ta.value };
        save();
        updateNav();
      }, 300);
    };
    const paper = app.querySelector("#paper");
    paper.onchange = () => {
      state.answers[t.id] = { ...(state.answers[t.id] || {}), text: ta.value, paper: paper.checked };
      save();
      updateNav();
    };
  }
  app.querySelector("#prev").onclick = () => showTask(i - 1);
  app.querySelector("#next") && (app.querySelector("#next").onclick = () => showTask(i + 1));
  app.querySelector("#finish") && (app.querySelector("#finish").onclick = () => confirmSubmit());
  const check = app.querySelector("#check");
  if (check)
    check.onclick = () => {
      state.revealed = state.revealed || {};
      state.revealed[t.id] = true;
      save();
      showTask(i);
      app.querySelector(".practice-out")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
  app.querySelectorAll(".task-nav [data-i]").forEach((b) => (b.onclick = () => showTask(+b.dataset.i)));
  window.scrollTo({ top: 0 });
}

function isAnswered(t) {
  const a = state.answers[t.id];
  if (!a) return false;
  return t.type === "flervalg" ? (a.sel || []).length > 0 : !!(a.text?.trim() || a.paper);
}

function navHtml(cur) {
  return exam.sections
    .map(
      (s, si) => `<div class="nav-sec"><p>${esc(s.title)}</p><div class="nav-btns">${tasks
        .map((t, i) => [t, i])
        .filter(([t]) => t._section === si)
        .map(
          ([t, i]) =>
            `<button data-i="${i}" class="${i === cur ? "cur" : ""} ${isAnswered(t) ? "done" : ""}" title="${esc(t.label || t.id)} · ${t.points} p">${esc(t.id)}</button>`
        )
        .join("")}</div></div>`
    )
    .join("");
}
function updateNav() {
  const nav = app.querySelector(".task-nav");
  if (nav) {
    nav.innerHTML = navHtml(state.current);
    nav.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => showTask(+b.dataset.i)));
  }
}

function flervalgHtml(t, ans, showKey) {
  const sel = ans.sel || [];
  return `<p class="hint">${t.single ? "Velg ett alternativ:" : "Velg ett eller flere alternativer:"}</p><div class="options">${t.options
    .map((o, k) => {
      const cls = showKey ? (o.correct ? "is-correct" : sel.includes(k) ? "is-wrong" : "") : "";
      return `<label class="opt ${cls}"><input type="${t.single ? "radio" : "checkbox"}" name="opt-${esc(t.id)}" value="${k}" ${sel.includes(k) ? "checked" : ""}><span>${md(o.text).replace(/^<p>|<\/p>$/g, "")}</span></label>`;
    })
    .join("")}</div>`;
}

function langsvarHtml(t, ans) {
  return `<label class="answer-label">Skriv ditt svar her <span class="muted">(lagres automatisk i nettleseren)</span></label>
    <textarea rows="12" spellcheck="false" placeholder="Mellomregning, begrunnelse og svar …">${esc(ans.text || "")}</textarea>
    <label class="paper"><input type="checkbox" id="paper" ${ans.paper ? "checked" : ""}> Jeg har løst denne på papir</label>`;
}

function feedbackHtml(t, ans) {
  if (t.type === "flervalg") {
    const sel = ans.sel || [];
    const sc = scoreFlervalg(t, sel);
    return `<div class="feedback"><p class="score-line">Du får <b>${fmtP(sc)} av ${fmtP(t.points)}</b> poeng.</p>
      <ul class="why">${t.options
        .map(
          (o, k) =>
            `<li class="${o.correct ? "ok" : "no"}"><span class="mark">${o.correct ? "✓ Riktig" : "✗ Galt"}</span>${sel.includes(k) ? ' <span class="chip">ditt kryss</span>' : ""} — ${md(o.text).replace(/^<p>|<\/p>$/g, "")}${o.why ? `<div class="muted">${md(o.why)}</div>` : ""}</li>`
        )
        .join("")}</ul>${t.solution ? `<div class="prose solution">${md(t.solution)}</div>` : ""}${manualLinks(t)}</div>`;
  }
  return `<div class="feedback"><h3>Løsningsforslag</h3><div class="prose solution">${md(t.solution)}</div>${rubricPreview(t)}${manualLinks(t)}</div>`;
}

function manualLinks(t) {
  const links = (t.topics || [])
    .map((id) => topics.find((x) => x.id === id))
    .filter((x) => x && x.manual)
    .map((x) => `<a href="manual.html#${x.manual}" target="_blank" rel="noopener">${esc(x.name)} ↗</a>`);
  return links.length ? `<p class="manual-links"><span class="muted">Les i manualen:</span> ${links.join(" ")}</p>` : "";
}

function rubricPreview(t) {
  if (!t.rubric?.length) return "";
  return `<h4>Poengmal</h4><ul class="rubric-list">${t.rubric.map(([p, txt]) => `<li><b>${fmtP(p)} p</b> ${md(txt).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ul>`;
}

// ---------- Topplinje og tidtaker ----------
function renderBar() {
  bar.hidden = false;
  bar.innerHTML = `
    <div class="bar-inner">
      <a class="bar-title" href="./" title="Til forsiden">STAT110</a>
      <span class="bar-exam">${esc(exam.short || exam.title)} · ${state.mode === "eksamen" ? "Eksamen" : "Øving"}</span>
      <span class="timer" id="timer"></span>
      ${state.mode === "ovelse" ? `<a class="btn small" href="manual.html" target="_blank" rel="noopener">Manual</a>` : ""}
      <button class="btn small" id="formelark">Formelark</button>
      <button class="btn small primary" id="submit">${state.mode === "eksamen" ? "Lever" : "Avslutt"}</button>
    </div>`;
  bar.querySelector("#formelark").onclick = () => window.open("formelark.html", "formelark", "width=980,height=900");
  bar.querySelector("#submit").onclick = () => confirmSubmit();
  clearInterval(timerHandle);
  const el = bar.querySelector("#timer");
  const tick = () => {
    if (state.mode !== "eksamen") {
      el.textContent = "Uten tid · " + fmtDuration(Date.now() - state.startedAt);
      return;
    }
    const left = state.deadline - Date.now();
    if (left <= 0) {
      clearInterval(timerHandle);
      el.textContent = "Tiden er ute";
      submit(true);
      return;
    }
    const h = Math.floor(left / 3600000),
      m = Math.floor((left % 3600000) / 60000),
      s = Math.floor((left % 60000) / 1000);
    el.textContent = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} igjen`;
    el.classList.toggle("warn", left < 15 * 60000);
  };
  tick();
  timerHandle = setInterval(tick, 1000);
}

function confirmSubmit() {
  const missing = tasks.filter((t) => !isAnswered(t)).length;
  const msg =
    (state.mode === "eksamen" ? "Lever besvarelsen?" : "Avslutte og se resultat?") +
    (missing ? `\n\n${missing} oppgave${missing > 1 ? "r" : ""} er ikke besvart.` : "");
  if (confirm(msg)) submit(false);
}

function submit(timeout) {
  clearInterval(timerHandle);
  const run = {
    id: uid(),
    examId,
    examTitle: exam.title,
    short: exam.short,
    kind: exam.kind,
    mode: state.mode,
    startedAt: state.startedAt,
    finishedAt: Date.now(),
    timeout: !!timeout,
    answers: state.answers,
    tasks: {},
  };
  for (const t of tasks) {
    const a = state.answers[t.id] || {};
    run.tasks[t.id] =
      t.type === "flervalg"
        ? { type: t.type, topics: t.topics, max: t.points, score: scoreFlervalg(t, a.sel || []), assessed: true }
        : { type: t.type, topics: t.topics, max: t.points, score: 0, assessed: false, checks: [] };
  }
  store.saveRun(run);
  store.clearActive(examId);
  history.replaceState(null, "", `?id=${examId}&run=${run.id}`);
  showResults(run);
}

// ---------- Resultater ----------
function totals(run) {
  let a = 0,
    m = 0,
    fl = 0,
    flm = 0,
    ls = 0,
    lsm = 0,
    unassessed = 0;
  for (const t of tasks) {
    const r = run.tasks[t.id];
    if (!r) continue;
    m += r.max;
    a += r.score;
    if (r.type === "flervalg") {
      fl += r.score;
      flm += r.max;
    } else {
      ls += r.score;
      lsm += r.max;
      if (!r.assessed) unassessed++;
    }
  }
  return { a: round2(a), m, fl: round2(fl), flm, ls: round2(ls), lsm, unassessed };
}

function showResults(run) {
  bar.hidden = false;
  clearInterval(timerHandle);
  bar.innerHTML = `<div class="bar-inner"><a class="bar-title" href="./">STAT110</a><span class="bar-exam">${esc(exam.short || exam.title)} · Resultat</span>
    <span class="timer"></span><button class="btn small" id="formelark">Formelark</button></div>`;
  bar.querySelector("#formelark").onclick = () => window.open("formelark.html", "formelark", "width=980,height=900");

  app.innerHTML = `
    <div class="results">
      <div class="card summary" id="summary"></div>
      ${tasks.map((t) => resultTaskHtml(t, run)).join("")}
      <div class="btns center">
        <a class="btn" href="./">← Forsiden</a>
        <a class="btn primary" href="eksamen.html?id=${examId}">Prøv igjen</a>
      </div>
    </div>`;
  renderSummary(run);
  typeset(app);

  app.querySelectorAll(".rubric input").forEach((cb) => {
    cb.onchange = () => {
      const id = cb.dataset.task;
      const t = tasks.find((x) => x.id === id);
      const checks = [...app.querySelectorAll(`.rubric input[data-task="${id}"]`)].map((x) => x.checked);
      const score = round2(t.rubric.reduce((s, [p], k) => s + (checks[k] ? p : 0), 0));
      Object.assign(run.tasks[id], { checks, score: Math.min(score, t.points), assessed: true });
      app.querySelector(`#score-${cssId(id)}`).textContent = fmtP(run.tasks[id].score);
      store.saveRun(run);
      renderSummary(run);
    };
  });
  app.querySelectorAll(".self-score").forEach((inp) => {
    inp.oninput = () => {
      const id = inp.dataset.task;
      const t = tasks.find((x) => x.id === id);
      const v = Math.max(0, Math.min(t.points, parseFloat(String(inp.value).replace(",", ".")) || 0));
      Object.assign(run.tasks[id], { score: v, assessed: inp.value !== "" });
      store.saveRun(run);
      renderSummary(run);
    };
  });
  app.querySelectorAll(".mark-zero").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.task;
      Object.assign(run.tasks[id], { score: 0, assessed: true, checks: [] });
      app.querySelectorAll(`.rubric input[data-task="${id}"]`).forEach((x) => (x.checked = false));
      app.querySelector(`#score-${cssId(id)}`).textContent = "0";
      b.textContent = "Satt til 0 ✓";
      store.saveRun(run);
      renderSummary(run);
    };
  });
}

function cssId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function renderSummary(run) {
  const T = totals(run);
  const el = app.querySelector("#summary");
  el.innerHTML = `
    <p class="eyebrow">${run.mode === "eksamen" ? "Eksamensmodus" : "Øvingsmodus"} · ${fmtDuration(run.finishedAt - run.startedAt)}${run.timeout ? " · tiden gikk ut" : ""}</p>
    <h1>${esc(exam.title)}</h1>
    <div class="score-big"><span>${fmtP(T.a)}</span> / ${fmtP(T.m)} poeng <em>(${pct(T.a, T.m)} %)</em></div>
    <div class="split">
      <div><b>Flervalg</b><br>${fmtP(T.fl)} / ${fmtP(T.flm)} p <span class="muted">· rettet automatisk</span></div>
      <div><b>Langsvar</b><br>${fmtP(T.ls)} / ${fmtP(T.lsm)} p <span class="muted">· din egen vurdering</span></div>
    </div>
    ${
      T.unassessed
        ? `<p class="notice">Du har ${T.unassessed} langsvarsoppgave${T.unassessed > 1 ? "r" : ""} igjen å rette. Huk av i poengmalen under hver oppgave. Resultatet lagres automatisk og brukes i studieradaren.</p>`
        : `<p class="notice ok">Alt er rettet og lagret. Se studieradaren på forsiden for hva du bør øve mer på.</p>`
    }`;
}

function resultTaskHtml(t, run) {
  const r = run.tasks[t.id];
  const a = run.answers?.[t.id] || {};
  const head = `<header class="task-head"><h2>${esc(t.label || t.id)}</h2>
      <span class="tag ${t.type}">${t.type === "langsvar" ? "Langsvar" : "Flervalg"}</span>
      <span class="pts"><b id="score-${cssId(t.id)}">${fmtP(r.score)}</b> / ${fmtP(t.points)} p</span></header>`;
  if (t.type === "flervalg") {
    return `<article class="card task result">${head}<details><summary>Vis oppgaven</summary><div class="prose">${md(t.prompt)}</div></details>
      ${feedbackHtml(t, a)}</article>`;
  }
  const yours = a.text?.trim()
    ? `<pre class="your-answer">${esc(a.text)}</pre>`
    : a.paper
    ? `<p class="muted">Løst på papir.</p>`
    : `<p class="muted">Ikke besvart.</p>`;
  const checks = r.checks || [];
  const rubric = t.rubric?.length
    ? `<div class="rubric"><h4>Rett deg selv: huk av det du fikk til</h4>${t.rubric
        .map(
          ([p, txt], k) =>
            `<label><input type="checkbox" data-task="${esc(t.id)}" ${checks[k] ? "checked" : ""}><b>${fmtP(p)} p</b><span>${md(txt).replace(/^<p>|<\/p>$/g, "")}</span></label>`
        )
        .join("")}<button class="btn small mark-zero" data-task="${esc(t.id)}">Jeg fikk ingenting her (0 p)</button></div>`
    : `<div class="rubric"><label>Dine poeng (0–${t.points}): <input class="self-score" data-task="${esc(t.id)}" inputmode="decimal" value="${r.assessed ? r.score : ""}"></label></div>`;
  return `<article class="card task result">${head}
    <details><summary>Vis oppgaven</summary>${exam.sections[t._section].intro ? `<div class="prose section-intro">${md(exam.sections[t._section].intro)}</div>` : ""}<div class="prose">${md(t.prompt)}</div></details>
    <h4>Ditt svar</h4>${yours}
    <h4>Løsningsforslag</h4><div class="prose solution">${md(t.solution)}</div>
    ${manualLinks(t)}
    ${rubric}</article>`;
}
