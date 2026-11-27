import { getJSON, md, typeset, esc, manualRead } from "./common.js";

const $ = (s) => document.querySelector(s);
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

let M, sections;

init().catch((e) => {
  $("#manual").innerHTML = `<div class="card error">Kunne ikke laste manualen: ${esc(e.message)}</div>`;
});

async function init() {
  M = await getJSON("data/manual.json");
  sections = M.parts.flatMap((p, pi) => p.sections.map((s, si) => ({ ...s, part: pi, num: `${ROMAN[pi]}.${si + 1}` })));

  $("#manual").innerHTML =
    `<header class="manual-head">
      <p class="eyebrow">Manual</p>
      <h1>${esc(M.title)}</h1>
      <div class="prose">${md(M.intro)}</div>
    </header>` +
    M.parts
      .map(
        (p, pi) => `<section class="manual-part" data-part="${pi}">
          <h2 class="part-title"><span>${ROMAN[pi]}</span> ${esc(p.title)}</h2>
          ${p.intro ? `<div class="prose part-intro">${md(p.intro)}</div>` : ""}
          ${sections.filter((s) => s.part === pi).map(sectionHtml).join("")}
        </section>`
      )
      .join("") +
    `<p class="muted small manual-foot">Manualen er skrevet for denne siden, med pensumlisten for STAT110 (Devore, Berk &amp; Carlton, kap. 1–9) som utgangspunkt. Den erstatter ikke boka og forelesningene. Finner du feil, si fra.</p>`;

  renderToc();
  typeset($("#manual"));
  wire();
  if (location.hash) {
    const go = () => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: "instant", block: "start" });
    go();
    document.fonts?.ready.then(go);
    setTimeout(go, 400);
  }
}

function sectionHtml(s) {
  const read = !!manualRead.all()[s.id];
  const practice = (s.practice || [])
    .map((p) => `<a class="chip practice" href="eksamen.html?id=${p.exam}&modus=ovelse&oppg=${encodeURIComponent(p.task)}">${esc(p.label)}</a>`)
    .join(" ");
  return `<article class="manual-sec card ${read ? "is-read" : ""}" id="${s.id}" data-id="${s.id}">
    <header>
      <span class="sec-num">${s.num}</span>
      <div>
        <h3>${esc(s.title)}</h3>
        ${s.keys ? `<p class="keys">${esc(s.keys)}</p>` : ""}
      </div>
    </header>
    <div class="prose">${md(s.body)}</div>
    <footer class="sec-foot">
      ${practice ? `<div class="practice-links"><span class="muted small">Øv på dette:</span> ${practice}</div>` : "<div></div>"}
      <button class="btn small read-btn" data-id="${s.id}">${read ? "✓ Lest" : "Merk som lest"}</button>
    </footer>
  </article>`;
}

function renderToc() {
  const read = manualRead.all();
  const n = sections.filter((s) => read[s.id]).length;
  $("#progress").innerHTML = `<div class="bar"><span style="width:${(100 * n) / sections.length}%"></span></div><span>${n} av ${sections.length} lest</span>`;
  $("#toc-list").innerHTML = M.parts
    .map(
      (p, pi) => `<div class="toc-part"><p>${ROMAN[pi]} · ${esc(p.title)}</p><ul>${sections
        .filter((s) => s.part === pi)
        .map((s) => `<li data-id="${s.id}"><a href="#${s.id}" class="${read[s.id] ? "read" : ""}"><span class="tick">${read[s.id] ? "✓" : ""}</span>${esc(s.title)}</a></li>`)
        .join("")}</ul></div>`
    )
    .join("");
  $("#toc-list")
    .querySelectorAll("a")
    .forEach((a) => (a.onclick = () => document.body.classList.remove("toc-open")));
}

function wire() {
  document.querySelectorAll(".read-btn").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.id;
        const on = !manualRead.all()[id];
        manualRead.set(id, on);
        b.textContent = on ? "✓ Lest" : "Merk som lest";
        b.closest(".manual-sec").classList.toggle("is-read", on);
        renderToc();
      })
  );

  // Søk
  const text = new Map(sections.map((s) => [s.id, (s.title + " " + (s.keys || "") + " " + s.body).toLowerCase()]));
  $("#search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let hits = 0;
    for (const s of sections) {
      const ok = !words.length || words.every((w) => text.get(s.id).includes(w));
      document.getElementById(s.id).hidden = !ok;
      document.querySelector(`#toc-list li[data-id="${s.id}"]`).hidden = !ok;
      if (ok) hits++;
    }
    document.querySelectorAll(".manual-part").forEach((p) => {
      p.hidden = ![...p.querySelectorAll(".manual-sec")].some((x) => !x.hidden);
    });
    document.querySelectorAll(".toc-part").forEach((p) => {
      p.hidden = ![...p.querySelectorAll("li")].some((x) => !x.hidden);
    });
    $("#progress").classList.toggle("searching", !!words.length);
    if (words.length) $("#progress").dataset.hits = `${hits} treff`;
  });

  // Marker seksjonen som vises i innholdsfortegnelsen
  const obs = new IntersectionObserver(
    (entries) => {
      for (const en of entries)
        if (en.isIntersecting) {
          document.querySelectorAll("#toc-list li.cur").forEach((x) => x.classList.remove("cur"));
          const li = document.querySelector(`#toc-list li[data-id="${en.target.id}"]`);
          li?.classList.add("cur");
        }
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  document.querySelectorAll(".manual-sec").forEach((s) => obs.observe(s));

  $("#toc-toggle").onclick = () => {
    const open = document.body.classList.toggle("toc-open");
    $("#toc-toggle").setAttribute("aria-expanded", open);
  };
}
