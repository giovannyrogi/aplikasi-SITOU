import localFont from "next/font/local";

/** Sumber font aplikasi. Ganti file font di sini saat mengganti keluarga font. */
export const appFont = localFont({
  src: [
    { path: "../fonts/poppins/poppins-latin-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/poppins/poppins-latin-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/poppins/poppins-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-app",
  display: "swap",
});

/** Dipakai CSS global, Material UI, Ant Design, dan grafik melalui theme. */
export const APP_FONT_FAMILY = "var(--font-app), Arial, sans-serif";
export const APP_FONT_WEIGHTS = Object.freeze({ regular: 500, medium: 600, bold: 700 });
