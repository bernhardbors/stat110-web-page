import { getJSON, typeset } from "./common.js";

const tabs = document.querySelectorAll("#tabs button");
function show(name) {
  tabs.forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.dataset.pane === name));
  history.replaceState(null, "", "#" + name);
}
tabs.forEach((b) => (b.onclick = () => show(b.dataset.tab)));
if (location.hash && document.querySelector(`[data-pane="${location.hash.slice(1)}"]`)) show(location.hash.slice(1));

const f3 = (v) => (v >= 1 ? "1.000" : v.toFixed(3).replace(/^0/, ""));
const f4 = (v) => v.toFixed(4).replace(/^0/, "");

function tbl(head, rows, cls = "") {
  return `<div class="table-wrap"><table class="num ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

getJSON("data/tables.json").then((T) => {
  // A.1
  document.getElementById("tA1").innerHTML = T.binomial.tables
    .map(
      (t) =>
        `<h3>n = ${t.n}</h3>` +
        tbl(
          ["x \\ p", ...T.binomial.p.map((p) => p.toFixed(2).replace(/^0/, ""))],
          t.rows.map((r, x) => [x, ...r.map(f3)])
        )
    )
    .join("");
  // A.2
  document.getElementById("tA2").innerHTML = T.poisson
    .map((g) => tbl(["x \\ μ", ...g.mus.map(String)], g.rows.map((r) => [r.x, ...r.vals.map(f3)])))
    .join("");
  // A.3
  document.getElementById("tA3").innerHTML = tbl(
    ["z", ...T.normal.cols],
    T.normal.rows.map((r) => [r.z, ...r.vals.map(f4)]),
    "normal"
  );
  // A.5
  document.getElementById("tA5").innerHTML = tbl(
    ["ν \\ α", ...T.t.alphas.map(String)],
    T.t.rows.map((r) => [r.nu, ...r.vals.map((v) => v.toFixed(3))])
  );
  // A.6
  document.getElementById("tA6").innerHTML = tbl(
    ["ν \\ α", ...T.chi2.alphas.map(String)],
    T.chi2.rows.map((r) => [r.nu, ...r.vals.map((v) => v.toFixed(3))])
  );
  document.querySelectorAll("table.num td").forEach((td) =>
    td.addEventListener("click", () => {
      document.querySelectorAll("table.num .hl").forEach((x) => x.classList.remove("hl"));
      td.classList.add("hl");
    })
  );
});
typeset(document.body);
