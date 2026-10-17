"use client";
import { useSyncExternalStore } from "react";
import { Box } from "@mui/material";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import FontStyle from "@/app/components/font-style/FontStyle";
import { LEAVE_UNIT } from "@/lib/leave/labels.mjs";
import { displayLeaveBalance, leaveBalanceIndicator, selectableBalances, selectedBalance } from "@/lib/dashboard/personalPresentation.mjs";
import DashboardMetric from "./DashboardMetric";

const memory = new Map();
function subscribe(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("sitou:balance-selection", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sitou:balance-selection", callback);
  };
}
export default function EmployeeBalanceMetric({ balances, year }) {
  const user = useAuthenticatedUser();
  const storageKey = `sitou:leave-balance:${user.organization_id}:${user.id}`;
  const selectedId = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return memory.get(storageKey) || localStorage.getItem(storageKey);
      } catch {
        return memory.get(storageKey) || null;
      }
    },
    () => null,
  );
  const rows = selectableBalances(balances);
  const row = selectedBalance(rows, selectedId);
  const shown = displayLeaveBalance(row);
  const indicator = leaveBalanceIndicator(shown);
  const choose = (id) => {
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      /* Mode privat: pilihan disimpan dalam memori. */
    }
    memory.set(storageKey, id);
    window.dispatchEvent(new Event("sitou:balance-selection"));
  };
  return (
    <DashboardMetric
      refined
      metric={{
        label: shown?.official ? "Sisa cuti & izin" : "Jatah cuti & izin",
        icon: "navigation:leave",
        tone: "brand",
        value: shown?.value,
        unit: shown ? LEAVE_UNIT[row.unit] : null,
        valueText: shown ? null : "Belum tersedia",
        description: shown
          ? shown.official
            ? `Terpakai ${shown.used} dari ${shown.allocated} ${LEAVE_UNIT[row.unit]} · ${year}`
            : `Jatah tahun ${year}.`
          : "Belum ada jenis cuti atau izin dengan jatah tahunan.",
        progress: indicator?.percent,
        progressTone: indicator?.tone,
        progressStatus: indicator?.label,
        progressAriaLabel: shown
          ? `Sisa jatah ${shown.value} dari ${shown.allocated} ${LEAVE_UNIT[row.unit]}`
          : undefined,
      }}
      selection={
        rows.length > 1 ? (
          <Box
            sx={{
              width: "100%",
              minWidth: 0,
              "& .ant-select-selection-item": { overflow: "hidden", textOverflow: "ellipsis" },
              "& .ant-select-selector": { minHeight: 44 },
            }}
          >
            <AsyncSelect
              aria-label="Jenis saldo cuti dan izin"
              value={row?.id}
              onChange={choose}
              options={rows.map((item) => ({ value: item.id, label: item.name }))}
              style={{ width: "100%", minHeight: 44 }}
              popupMatchSelectWidth
              styles={{ popup: { root: { maxWidth: "calc(100vw - 32px)" } } }}
            />
          </Box>
        ) : row ? (
          <FontStyle fontSize={13} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
            {row.name}
          </FontStyle>
        ) : null
      }
    />
  );
}
