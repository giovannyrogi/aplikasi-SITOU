export const PASSWORD_HELP_TEXT =
  "Minimal 6 karakter dengan huruf besar, huruf kecil, angka, dan simbol.";

export const PASSWORD_FORM_RULES = [
  { required: true, message: "Password wajib diisi." },
  { min: 6, message: "Password minimal 6 karakter." },
  {
    validator: (_, value) =>
      !value || new TextEncoder().encode(value).length <= 72
        ? Promise.resolve()
        : Promise.reject(new Error("Password maksimal 72 byte.")),
  },
  { pattern: /[a-z]/, message: "Password wajib memiliki huruf kecil." },
  { pattern: /[A-Z]/, message: "Password wajib memiliki huruf besar." },
  { pattern: /\d/, message: "Password wajib memiliki angka." },
  { pattern: /[^A-Za-z0-9]/, message: "Password wajib memiliki simbol." },
];
