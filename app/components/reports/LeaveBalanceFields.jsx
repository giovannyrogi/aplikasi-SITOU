"use client";

import { Box, useTheme } from "@mui/material";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import { leaveBalanceCondition } from "@/lib/reports/leavePresentation.mjs";
import FontStyle from "@/app/components/font-style/FontStyle";
import { LEAVE_UNIT } from "@/lib/leave/labels.mjs";

export const LEAVE_BALANCE_FIELDS = [
  {
    key: "allocated",
    label: "Hak",
    description: "Hak saldo tahun pilihan, termasuk saldo bawaan dan koreksi.",
  },
  {
    key: "used",
    label: "Terpakai",
    description: "Pemakaian saldo setelah dikurangi pengembalian dari pembatalan.",
  },
  {
    key: "balance",
    label: "Sisa",
    description: "Saldo yang masih tersedia dari seluruh transaksi saldo resmi.",
  },
];

/** Angka saldo utuh dan bersatuan; tidak membuat saldo palsu saat entitlement belum ada. */
export function LeaveBalanceValue({ row, field, compact = false }) {
  const emphasis = field === "balance";
  const formatted = new Intl.NumberFormat("id-ID").format(Number(row[field]));
  if (emphasis) {
    const condition = leaveBalanceCondition(row);
    return (
      <Box
        role="group"
        aria-label={`Sisa ${formatted} ${LEAVE_UNIT[row.unit]} · ${condition.label}`}
        sx={{ display: "grid", justifyItems: "center", gap: 0.5 }}
      >
        <CompactInfoChip
          label={`${formatted} ${LEAVE_UNIT[row.unit]}`}
          tone={condition.tone}
          sx={{
            minHeight: 28,
            "& .MuiChip-label": {
              fontSize: 13,
              fontWeight: 700,
              px: 1.25,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              lineHeight: 1.4,
            },
          }}
        />
        <FontStyle fontSize={11} sx={{ color: "text.secondary" }}>
          {condition.label}
        </FontStyle>
      </Box>
    );
  }
  return (
    <Box
      role="group"
      aria-label={`${LEAVE_BALANCE_FIELDS.find((item) => item.key === field)?.label} ${formatted} ${LEAVE_UNIT[row.unit]}`}
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 0.5,
        px: emphasis ? 1.25 : 0,
        py: emphasis ? 0.75 : 0,
        borderRadius: 1,
        color: "text.primary",
        maxWidth: "100%",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <FontStyle
        component="span"
        fontSize={compact ? 18 : 15}
        fontWeight={700}
        sx={{ overflowWrap: "anywhere" }}
      >
        {formatted}
      </FontStyle>
      <FontStyle component="span" fontSize={12}>
        {LEAVE_UNIT[row.unit]}
      </FontStyle>
    </Box>
  );
}

export function LeaveBalanceEmpty({ row }) {
  return (
    <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
      {row.uses_balance ? "Saldo belum tersedia" : "Tidak menggunakan saldo"}
    </FontStyle>
  );
}

/** Saldo mobile memakai label dan angka yang sama dengan tiga kolom desktop. */
export default function LeaveBalanceFields({ row, year }) {
  const theme = useTheme();
  return (
    <Box
      component="section"
      aria-label={`Saldo ${year}`}
      sx={{ pt: 2, borderTop: "1px solid", borderColor: "divider", minWidth: 0 }}
    >
      <FontStyle fontSize={12} fontWeight={600} sx={{ mb: 1.5 }}>
        Saldo {year}
      </FontStyle>
      {row.balance == null || !row.uses_balance ? (
        <LeaveBalanceEmpty row={row} />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 1 }}>
          {LEAVE_BALANCE_FIELDS.map((field) => (
            <Box
              key={field.key}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                minWidth: 0,
              }}
            >
              <FontStyle fontSize={12} fontWeight={600} sx={{ color: theme.ui.mutedText }}>
                {field.label}
              </FontStyle>
              <LeaveBalanceValue row={row} field={field.key} compact />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
