// Pemilih skema berbentuk kartu radio (dipakai halaman daftar dan tambah skema).
// Radio aslinya tetap ada, transparan dan menutupi seluruh kartu (bukan sr-only), sehingga fokus, panah papan
// ketik, pembaca layar, kendali suara, dan klik di mana pun pada kartu bekerja; yang tampak adalah kartu dengan
// ikon dan penanda pilihan.
import { h, icon } from "./ui.js";

const IKON = { dasar: "flask", terapan: "wrench" };

// skema: [{slug, judul, ringkasan}]; excluded: slug yang tidak ditampilkan; preselect: slug awal.
export function renderSkemaPicker(container, skema, { name = "skema", preselect = "", excluded = [] } = {}) {
  const items = skema.filter((s) => !excluded.includes(s.slug));
  container.replaceChildren(
    ...items.map((s, i) =>
      h("label", { class: "relative flex cursor-pointer items-start gap-4 rounded-2xl border border-line-3 bg-layer p-4 transition-colors hover:bg-muted-hover has-checked:border-primary has-checked:bg-primary-50 has-checked:ring-1 has-checked:ring-primary has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-focus dark:has-checked:bg-primary-950" },
        h("input", { type: "radio", name, value: s.slug, required: true, checked: s.slug === preselect || (!preselect && items.length === 1 && i === 0), class: "peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" }),
        h("span", { class: "grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300" }, icon(IKON[s.slug] || "layers", "size-5")),
        h("span", { class: "min-w-0 flex-1" },
          h("span", { class: "block font-display text-xl font-medium leading-tight", text: s.judul }),
          h("span", { class: "mt-1 block text-[13px] leading-5 text-muted-foreground-1", text: s.ringkasan || "" })),
        h("span", { class: "mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 border-line-4 text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground" }, icon("check", "size-3")),
      )),
  );
  return () => {
    const checked = container.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : "";
  };
}
