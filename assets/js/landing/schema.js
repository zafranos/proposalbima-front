// Skema bidang landing yang dapat disunting. Data murni (tanpa DOM), jadi dapat dimuat di Node juga.
//
// Satu-satunya tempat yang menyebut nama bidang:
//  - editor admin (pages/admin-landing.js) membangun formulirnya dari sini;
//  - scripts/check.mjs memastikan jalur di sini sama persis dengan atribut data-edit / data-list di index.html
//    dan teks bawaan halaman muat dalam batas panjang bidangnya.
// Backend tidak mengenal nama bidang: ia hanya menjamin bentuk, ukuran, dan teks polos (model/landing.go).
//
// Bidang: { path, label, max, rows? }  rows > 1 = kolom teks banyak baris.
// Daftar: { path, label, itemLabel, max (jumlah butir), keys: [{ key, label, max, rows?, optional? }] }
//   key tanpa optional wajib terisi pada setiap butir.

export const SECTIONS = [
  {
    id: "hero", title: "Beranda", note: "Bagian paling atas halaman.",
    fields: [
      { path: "hero.chip", label: "Label di atas judul", max: 80 },
      { path: "hero.title", label: "Judul", max: 80 },
      { path: "hero.highlight", label: "Judul, bagian yang distabilo", max: 40 },
      { path: "hero.lead", label: "Paragraf pembuka", max: 320, rows: 3 },
      { path: "hero.cta_primary", label: "Tombol utama", max: 30 },
      { path: "hero.cta_secondary", label: "Tombol kedua", max: 30 },
    ],
    lists: [
      { path: "hero.bullets", label: "Butir di bawah tombol", itemLabel: "Butir", max: 5, keys: [{ key: "text", label: "Teks", max: 90 }] },
    ],
  },
  {
    id: "cara", title: "Cara kerja", note: "Tiga langkah awal.",
    fields: [
      { path: "cara.title", label: "Judul bagian", max: 80 },
      { path: "cara.s1.title", label: "Langkah 1, judul", max: 60 },
      { path: "cara.s1.text", label: "Langkah 1, uraian", max: 320, rows: 3 },
      { path: "cara.s2.title", label: "Langkah 2, judul", max: 60 },
      { path: "cara.s2.text", label: "Langkah 2, uraian", max: 320, rows: 3 },
      { path: "cara.s3.title", label: "Langkah 3, judul", max: 60 },
      { path: "cara.s3.text", label: "Langkah 3, uraian", max: 320, rows: 3 },
    ],
  },
  {
    id: "alur", title: "Alur penyusunan", note: "Garis waktu langkah dari topik sampai proposal siap submit.",
    fields: [
      { path: "alur.title", label: "Judul bagian", max: 120, rows: 2 },
      { path: "alur.text", label: "Paragraf pengantar", max: 320, rows: 3 },
    ],
    lists: [
      {
        path: "alur.items", label: "Langkah alur", itemLabel: "Langkah", max: 14,
        keys: [
          { key: "label", label: "Penanda (mis. Fase 3)", max: 24 },
          { key: "title", label: "Judul langkah", max: 140, rows: 2 },
          { key: "code", label: "Rujukan bagian proposal (opsional)", max: 30, optional: true },
        ],
      },
    ],
  },
  {
    id: "skema", title: "Skema", note: "Kartu skema diambil dari data skema di server, bukan dari sini.",
    fields: [{ path: "skema.title", label: "Judul bagian", max: 80 }],
  },
  {
    id: "fitur", title: "Yang Anda dapatkan", note: "Kotak ketiga memuat daftar acuan aturan dari server, jadi hanya judulnya yang dapat diubah.",
    fields: [
      { path: "fitur.title", label: "Judul bagian", max: 100, rows: 2 },
      { path: "fitur.f1.title", label: "Kotak 1, judul", max: 70 },
      { path: "fitur.f1.text", label: "Kotak 1, uraian", max: 280, rows: 3 },
      { path: "fitur.f2.title", label: "Kotak 2, judul", max: 70 },
      { path: "fitur.f3.title", label: "Kotak 3, judul", max: 70 },
      { path: "fitur.f3.text", label: "Kotak 3, uraian", max: 280, rows: 3 },
      { path: "fitur.f4.title", label: "Kotak 4, judul", max: 70 },
      { path: "fitur.f4.text", label: "Kotak 4, uraian", max: 280, rows: 3 },
      { path: "fitur.f5.title", label: "Kotak 5, judul", max: 70 },
      { path: "fitur.f5.text", label: "Kotak 5, uraian", max: 280, rows: 3 },
    ],
  },
  {
    id: "faq", title: "Tanya jawab",
    fields: [{ path: "faq.title", label: "Judul bagian", max: 80 }],
    lists: [
      {
        path: "faq.items", label: "Pertanyaan", itemLabel: "Pertanyaan", max: 20,
        keys: [
          { key: "q", label: "Pertanyaan", max: 140 },
          { key: "a", label: "Jawaban", max: 600, rows: 4 },
        ],
      },
    ],
  },
  {
    id: "cta", title: "Ajakan di bagian bawah",
    fields: [
      { path: "cta.title", label: "Judul", max: 100, rows: 2 },
      { path: "cta.text", label: "Uraian", max: 240, rows: 2 },
      { path: "cta.primary", label: "Tombol utama", max: 30 },
      { path: "cta.secondary", label: "Tombol kedua", max: 30 },
    ],
  },
  {
    id: "footer", title: "Kaki halaman", note: "Tautan dan kredit pengembang di kaki halaman tetap dan tidak dapat diubah dari sini.",
    fields: [{ path: "footer.about", label: "Deskripsi singkat", max: 240, rows: 3 }],
  },
];

export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields || []);
export const ALL_LISTS = SECTIONS.flatMap((s) => s.lists || []);
