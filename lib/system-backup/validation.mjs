import { z } from "zod";

/** Kata sandi paket tidak mengikuti aturan password akun, tetapi tetap wajib diisi. */
export const createBackupSchema = z.object({
  password: z.string().min(1, "Kata sandi backup wajib diisi.").max(128)
    .refine((value) => value.trim().length > 0, "Kata sandi backup wajib diisi.")
    .refine((value) => !/[\r\n]/.test(value), "Kata sandi tidak boleh memuat baris baru."),
  confirmPassword: z.string(),
}).strict().refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"], message: "Konfirmasi kata sandi tidak sama.",
});
