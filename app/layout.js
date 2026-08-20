import { Poppins } from "next/font/google";
import "./globals.css";
import "antd/dist/reset.css";
// import "@ant-design/v5-patch-for-react-19";
import AppProviders from "./components/approvider/AppProviders";
import { APP_LOGO_ASSETS } from "./components/branding/AppLogo";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

const poppins = Poppins({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata = {
  title: "SITOU",
  description: "Sistem Informasi Tenaga Operasional Unit",
  icons: {
    icon: "/favicon.ico",
    apple: APP_LOGO_ASSETS.mark,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={poppins.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
