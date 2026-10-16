import { appFont, APP_FONT_FAMILY } from "./theme/typography";
import "./globals.css";
import "antd/dist/reset.css";
// import "@ant-design/v5-patch-for-react-19";
import AppProviders from "./components/approvider/AppProviders";
import { APP_LOGO_ASSETS } from "./components/branding/AppLogo";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

export const metadata = {
  title: "SITOU",
  description: "Sistem Informasi Teknologi dan Organisasi Unit",
  icons: {
    icon: "/favicon.ico",
    apple: APP_LOGO_ASSETS.mark,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={appFont.variable} style={{ "--sitou-font-family": APP_FONT_FAMILY }}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
