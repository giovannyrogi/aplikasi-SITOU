"use client";

import { CheckCircleFilled } from "@ant-design/icons";
import { Input, theme as antdTheme } from "antd";
import {
  INDONESIAN_NATIONAL_ID_LENGTH,
  isValidIndonesianNationalId,
  normalizeIndonesianNationalId,
} from "@/lib/validation/indonesianNationalId";

/** Input NIK terpusat dengan pembatas digit dan indikator kelengkapan yang aksesibel. */
export default function IndonesianNationalIdInput({ value, onChange, ...props }) {
  const { token } = antdTheme.useToken();
  const normalized = (normalizeIndonesianNationalId(value) || "").slice(
    0,
    INDONESIAN_NATIONAL_ID_LENGTH,
  );
  const valid = isValidIndonesianNationalId(normalized);

  const updateValue = (event) => {
    const nextValue = (normalizeIndonesianNationalId(event.target.value) || "").slice(
      0,
      INDONESIAN_NATIONAL_ID_LENGTH,
    );
    onChange?.(nextValue);
  };

  return (
    <Input
      {...props}
      value={normalized}
      onChange={updateValue}
      inputMode="numeric"
      autoComplete="off"
      maxLength={INDONESIAN_NATIONAL_ID_LENGTH}
      placeholder={props.placeholder || "Masukkan 16 digit NIK"}
      suffix={
        <span
          aria-live="polite"
          aria-label={valid ? "NIK lengkap, 16 digit" : `${normalized.length} dari 16 digit`}
          style={{
            minWidth: 34,
            display: "inline-flex",
            justifyContent: "flex-end",
            color: valid ? token.colorSuccess : token.colorTextSecondary,
            fontWeight: 600,
          }}
        >
          {valid ? <CheckCircleFilled title="NIK valid" /> : `${normalized.length}/16`}
        </span>
      }
    />
  );
}
