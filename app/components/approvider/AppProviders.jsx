"use client";

import moment from "moment";
import "moment/locale/id";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import { LoadingBackdropProvider } from "../loading/LoadingBackdropProvider";
import AppThemeProvider, { BRAND_COLORS, STATUS_TONES } from "../themeprovider/ThemeProvider";

moment.locale("id");

export default function AppProviders({ children }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: BRAND_COLORS.primary,
            colorInfo: STATUS_TONES.info.main,
            colorSuccess: STATUS_TONES.success.main,
            colorWarning: STATUS_TONES.warning.main,
            colorError: STATUS_TONES.danger.main,
            colorText: "#1F2937",
            colorTextSecondary: "#5F6B7A",
            colorBorder: "#D8DEE8",
            colorBgLayout: "#F6F7F9",
            borderRadius: 8,
            fontFamily: "Poppins, sans-serif",
            controlHeight: 44,
            // Popup AntD dirender ke body; layer ini harus berada di atas AppModal MUI (1300).
            zIndexPopupBase: 1500,
          },
          components: {
            Table: { headerBg: "#F8F9FB", headerColor: "#374151", rowHoverBg: "#FFF5F5" },
            Button: { primaryShadow: "0 6px 16px rgba(230, 9, 9, 0.18)" },
          },
        }}
      >
        <AppThemeProvider>
          <LocalizationProvider dateAdapter={AdapterMoment} adapterLocale="id">
            <LoadingBackdropProvider>{children}</LoadingBackdropProvider>
          </LocalizationProvider>
        </AppThemeProvider>
      </ConfigProvider>
    </AntdRegistry>
  );
}
