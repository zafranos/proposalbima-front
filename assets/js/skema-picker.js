// Pemilih skema berbentuk kartu radio (dipakai halaman daftar dan tambah skema).
import { h } from "./ui.js";

// skema: [{slug, judul, ringkasan}]; excluded: slug yang tidak ditampilkan; preselect: slug awal.
export function renderSkemaPicker(container, skema, { name = "skema", preselect = "", excluded = [] } = {}) {
  const items = skema.filter((s) => !excluded.includes(s.slug));
  container.replaceChildren(
    ...items.map((s, i) =>
      h("label", { class: "flex cursor-pointer items-start gap-3 rounded-lg border border-line-2 p-3 hover:bg-muted-hover has-checked:border-primary has-checked:bg-primary-50 has-focus-visible:ring-2 has-focus-visible:ring-primary-focus dark:has-checked:bg-primary-950" },
        h("input", { type: "radio", name, value: s.slug, required: true, checked: s.slug === preselect || (!preselect && items.length === 1 && i === 0), class: "mt-1 size-4 accent-teal-700" }),
        h("span", {},
          h("span", { class: "block text-sm font-medium", text: s.judul }),
          h("span", { class: "block text-xs text-muted-foreground-1", text: s.ringkasan || "" })),
      )),
  );
  return () => {
    const checked = container.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : "";
  };
}
