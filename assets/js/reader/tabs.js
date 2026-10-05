// Tab untuk modul yang punya bagian varian (skema Terapan): "Varian Terapan" dan "Fase (dasar)".
// Pola ARIA tab: tombol role=tab dengan panah kiri/kanan, panel role=tabpanel.
import { h } from "../ui.js";


// parts: [{kunci, judul}]; panels: {kunci: HTMLElement}; mengembalikan {el, select}
export function renderTabs(parts, panels, activeKey, onChange) {
  const list = h("div", { role: "tablist", "aria-label": "Bagian materi", class: "tab-list" });
  const tabs = parts.map((p) => h("button", {
    type: "button", role: "tab", id: `tab-${p.kunci}`, "aria-controls": `panel-${p.kunci}`, class: "tab",
    text: p.judul || p.kunci,
  }));
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(parts[i].kunci, true));
    t.addEventListener("keydown", (e) => {
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const next = (i + dir + tabs.length) % tabs.length;
      tabs[next].focus();
      select(parts[next].kunci, true);
    });
  });
  list.append(...tabs);

  function select(key, notify) {
    parts.forEach((p, i) => {
      const on = p.kunci === key;
      tabs[i].setAttribute("aria-selected", String(on));
      tabs[i].tabIndex = on ? 0 : -1;
      const panel = panels[p.kunci];
      panel.hidden = !on;
      panel.setAttribute("role", "tabpanel");
      panel.id = `panel-${p.kunci}`;
      panel.setAttribute("aria-labelledby", `tab-${p.kunci}`);
    });
    if (notify && onChange) onChange(key);
  }
  select(activeKey, false);
  return { el: list, select };
}
