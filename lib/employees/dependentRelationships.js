/** Pilihan hubungan keluarga dipakai bersama oleh UI, API, detail, dan import. */
export const DEPENDENT_RELATIONSHIP_OPTIONS = Object.freeze(
  [
    ["wife", "Istri"],
    ["husband", "Suami"],
    ["child", "Anak"],
    ["father", "Ayah"],
    ["mother", "Ibu"],
    ["sibling", "Saudara kandung"],
    ["father_in_law", "Ayah mertua"],
    ["mother_in_law", "Ibu mertua"],
    ["grandfather", "Kakek"],
    ["grandmother", "Nenek"],
    ["grandchild", "Cucu"],
    ["guardian", "Wali"],
    ["other", "Lainnya"],
  ].map(([value, label]) => Object.freeze({ value, label })),
);

export const DEPENDENT_RELATIONSHIP_VALUES = Object.freeze(
  DEPENDENT_RELATIONSHIP_OPTIONS.map((option) => option.value),
);

export const DEPENDENT_RELATIONSHIP_LABELS = Object.freeze(
  Object.fromEntries(DEPENDENT_RELATIONSHIP_OPTIONS.map((option) => [option.value, option.label])),
);

const LEGACY_DEPENDENT_RELATIONSHIP_MESSAGES = Object.freeze({
  pasangan: "Hubungan Pasangan sudah tidak digunakan. Pilih Istri atau Suami.",
  spouse: "Hubungan Pasangan sudah tidak digunakan. Pilih Istri atau Suami.",
  "orang tua": "Hubungan Orang tua sudah tidak digunakan. Pilih Ayah atau Ibu.",
  parent: "Hubungan Orang tua sudah tidak digunakan. Pilih Ayah atau Ibu.",
  grandparent: "Pilih Kakek atau Nenek sebagai hubungan keluarga.",
});

export function formatDependentRelationship(value) {
  return DEPENDENT_RELATIONSHIP_LABELS[value] || value;
}

export function getLegacyDependentRelationshipMessage(value) {
  const normalized = String(value || "")
    .trim()
    .toLocaleLowerCase("id-ID");
  return LEGACY_DEPENDENT_RELATIONSHIP_MESSAGES[normalized] || null;
}
