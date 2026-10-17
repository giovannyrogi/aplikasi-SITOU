"use client";
import { useSyncExternalStore } from "react";
import { Box } from "@mui/material";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import FontStyle from "@/app/components/font-style/FontStyle";
import { LEAVE_UNIT } from "@/lib/leave/labels.mjs";
import { selectableBalances, selectedBalance } from "@/lib/dashboard/personalPresentation.mjs";
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
  const choose = (id) => {
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      /* Mode privat: pilihan disimpan dalam memori. */
    }
    memory.set(storageKey, id);
    window.dispatchEvent(new Event("sitou:balance-selection"));
  };
  const available = row?.balance != null;
  return (
    <DashboardMetric
      refined
      metric={{
        label: "Saldo cuti & izin",
        icon: "navigation:leave",
        tone: "brand",
        value: available ? Number(row.balance) : null,
        unit: available ? LEAVE_UNIT[row.unit] : null,
        valueText: available ? null : row ? "Belum ditetapkan" : "Belum tersedia",
        description: available
          ? `Terpakai ${row.used} dari ${row.allocated} ${LEAVE_UNIT[row.unit]} · ${year}`
          : row
            ? `Hak saldo tahun ${year} belum ditetapkan.`
            : "Belum ada jenis cuti/izin dengan saldo.",
        progress:
          available && Number(row.allocated) > 0
            ? (Number(row.used) / Number(row.allocated)) * 100
            : undefined,
      }}
      selection={
        rows.length > 1 ? (
          <Box
            sx={{
              width: "100%",
              minWidth: 0,
              "& .ant-select-selection-item": {
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                lineHeight: "20px",
                paddingBlock: "8px",
              },
              "& .ant-select-selector": { minHeight: 44, height: "auto !important" },
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
