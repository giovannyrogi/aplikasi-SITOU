"use client";

import { Input, Space } from "antd";
import {
  getIndonesianMobileLocalValue,
  normalizeIndonesianMobile,
} from "@/lib/validation/indonesianPhone";

/** Input nomor Indonesia terpusat; nilai Form selalu berupa E.164 +628... */
export default function IndonesiaPhoneInput({ value, onChange, style, size, ...props }) {
  const updateValue = (event) => {
    let digits = event.target.value.replace(/\D/g, "");
    if (digits.startsWith("62")) digits = digits.slice(2);
    digits = digits.replace(/^0+/, "").slice(0, 12);
    onChange?.(digits ? normalizeIndonesianMobile(digits) : null);
  };

  return (
    <Space.Compact block size={size} style={style}>
      <Input
        aria-label="Kode negara Indonesia"
        value="+62"
        readOnly
        tabIndex={-1}
        disabled={props.disabled}
        style={{ width: 70, flex: "0 0 70px", textAlign: "center", pointerEvents: "none" }}
      />
      <Input
        {...props}
        value={getIndonesianMobileLocalValue(value)}
        onChange={updateValue}
        inputMode="numeric"
        autoComplete="tel"
        maxLength={12}
        placeholder={props.placeholder || "82123456789"}
        style={{ minWidth: 0, flex: 1 }}
      />
    </Space.Compact>
  );
}
