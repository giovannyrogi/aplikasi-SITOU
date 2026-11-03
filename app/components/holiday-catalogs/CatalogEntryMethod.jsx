"use client";
import { Radio } from "antd";
import { CloudDownloadOutlined, EditOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

export default function CatalogEntryMethod({ value, onChange, disabled }) {
  const theme = useTheme();
  const options = [
    {
      value: "automatic",
      title: "Ambil otomatis",
      description: "Ambil tanggal setahun dari sumber data.",
      icon: <CloudDownloadOutlined aria-hidden />,
    },
    {
      value: "manual",
      title: "Input manual + PDF",
      description: "Isi tanggal dan unggah dokumen SKB.",
      icon: <EditOutlined aria-hidden />,
    },
  ];
  return (
    <Radio.Group
      name="catalog-entry-method"
      aria-label="Cara pengisian katalog"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ display: "grid", width: "100%" }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
          gap: 2,
          "& .ant-radio-wrapper": {
            m: 0,
            p: 2,
            minHeight: 88,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            alignItems: "flex-start",
            whiteSpace: "normal",
          },
          "& .ant-radio-wrapper-checked": {
            borderColor: theme.brand.primary,
            backgroundColor: theme.palette.action.hover,
          },
          "& .ant-radio": { mt: 0.25, alignSelf: "flex-start" },
          "& .ant-radio-wrapper > span:last-child": { minWidth: 0, flex: 1 },
        }}
      >
        {options.map((option) => (
          <Radio key={option.value} value={option.value}>
            <Box component="span" sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.75 }}>
              {option.icon}
              <FontStyle component="span" fontSize={14} fontWeight={600}>
                {option.title}
              </FontStyle>
            </Box>
            <FontStyle component="span" fontSize={14} color="text.secondary">
              {option.description}
            </FontStyle>
          </Radio>
        ))}
      </Box>
    </Radio.Group>
  );
}
