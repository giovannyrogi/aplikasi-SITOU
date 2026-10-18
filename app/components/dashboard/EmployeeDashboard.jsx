"use client";
import { useState } from "react";
import { Box, Button } from "@mui/material";
import dayjs from "dayjs";
import DataPanel from "@/app/components/data-display/DataPanel";
import AppIcon from "@/app/components/icons/AppIcon";
import AppIconTile from "@/app/components/icons/AppIconTile";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppModal from "@/app/components/modals/AppModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import DashboardMetric from "./DashboardMetric";
import EmployeeLeavePanel from "./EmployeeLeavePanel";
import EmployeeDisciplinePanel from "./EmployeeDisciplinePanel";
import EmployeeBalanceMetric from "./EmployeeBalanceMetric";
import { serviceMetric } from "@/lib/dashboard/personalPresentation.mjs";

const date = (value) => (value ? dayjs(value).format("D MMM YYYY") : "Belum tersedia");
const contractStatus = {
  active: "Aktif",
  expired: "Berakhir",
  terminated: "Diakhiri",
  renewed: "Diperbarui",
};
function Facts({ values }) {
  return (
    <Box
      component="dl"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
        gap: 3,
        m: 0,
      }}
    >
      {values.map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <FontStyle component="dt" fontSize={12} sx={{ color: "text.secondary", mb: 1 }}>
            {label}
          </FontStyle>
          <FontStyle
            component="dd"
            fontSize={13}
            fontWeight={600}
            sx={{ m: 0, overflowWrap: "anywhere" }}
          >
            {value || "Belum tersedia"}
          </FontStyle>
        </Box>
      ))}
    </Box>
  );
}
export default function EmployeeDashboard({ dashboardState }) {
  const { data } = dashboardState;
  const [detail, setDetail] = useState(null);
  const contract = data?.contract;
  const sectionSx = { scrollMarginTop: 92, outlineOffset: 4, minWidth: 0 };
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      {data ? (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0,1fr)",
                sm: "repeat(2,minmax(0,1fr))",
                lg: "repeat(3,minmax(0,1fr))",
              },
              gap: 3,
            }}
          >
            {data.leave ? <EmployeeBalanceMetric balances={data.leave.balances} /> : null}
            <DashboardMetric
              balanced
              refined
              metric={{
                label: "Masa kerja",
                ...serviceMetric(data.employment, data.today),
                description: `Bergabung sejak ${date(data.employment.joinedDate)}.`,
                icon: "navigation:employees",
                tone: "info",
              }}
            />
            {data.discipline ? (
              <DashboardMetric
                balanced
                refined
                metric={{
                  label: "Sanksi aktif",
                  value: data.discipline.active,
                  unit: "sanksi",
                  description: data.discipline.active
                    ? "Tindakan resmi yang masih berlaku hari ini."
                    : "Tidak ada sanksi yang aktif saat ini.",
                  icon: "solar:shield-check-bold-duotone",
                  tone: data.discipline.active ? "warning" : "success",
                }}
              />
            ) : null}
          </Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.6fr) minmax(0,1fr)" },
              gap: 3,
              alignItems: "start",
            }}
          >
            <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
              {data.leave ? (
                <EmployeeLeavePanel leave={data.leave} year={data.today.slice(0, 4)} />
              ) : null}
              {data.discipline ? <EmployeeDisciplinePanel discipline={data.discipline} /> : null}
            </Box>
            <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
              {data.assignment ? (
                <Box id="employee-placement" tabIndex={-1} sx={sectionSx}>
                  <DataPanel title="Penempatan saya" contentSx={{ p: 3 }}>
                    <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center" }}>
                      <AppIconTile icon="navigation:location" />
                      <Box sx={{ minWidth: 0 }}>
                        <FontStyle fontSize={14} fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                          {data.assignment.location || "Belum ada penempatan"}
                        </FontStyle>
                        <FontStyle fontSize={11} sx={{ mt: 1, color: "text.secondary" }}>
                          {data.organization}
                        </FontStyle>
                      </Box>
                    </Box>
                    <Facts
                      values={[
                        ["Jabatan", data.assignment.position],
                        ["Divisi & Unit", data.assignment.unit],
                        ...(data.assignment.supervisor
                          ? [["Atasan langsung", data.assignment.supervisor]]
                          : []),
                      ]}
                    />
                  </DataPanel>
                </Box>
              ) : null}
              {Object.hasOwn(data, "contract") ? (
                <Box id="employee-contract" tabIndex={-1} sx={sectionSx}>
                  <DataPanel
                    title="Kontrak saya"
                    description="Kontrak yang berlaku atau histori terakhir Anda."
                    contentSx={{ p: 3 }}
                  >
                    {contract ? (
                      <>
                        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
                          <AppIconTile icon="navigation:expiring-contract" />
                          <Box>
                            <FontStyle fontSize={14} fontWeight={700}>
                              {data.employment.type || "Kontrak kerja"}
                            </FontStyle>
                            <CompactInfoChip
                              label={contractStatus[contract.status] || contract.status}
                              tone={contract.status === "active" ? "success" : "neutral"}
                            />
                          </Box>
                        </Box>
                        <Facts
                          values={[
                            ["Mulai berlaku", date(contract.start)],
                            ...(contract.requiresEndDate
                              ? [["Tanggal akhir", date(contract.end)]]
                              : []),
                          ]}
                        />
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() =>
                            setDetail({
                              title: "Kontrak saya",
                              description: data.employment.type,
                              values: [
                                ["Status", contractStatus[contract.status]],
                                ["Mulai berlaku", date(contract.start)],
                                ...(contract.requiresEndDate
                                  ? [["Tanggal akhir", date(contract.end)]]
                                  : []),
                              ],
                            })
                          }
                          startIcon={<AppIcon icon="solar:eye-linear" width={18} />}
                          sx={{ mt: 3, minHeight: 44 }}
                        >
                          Lihat rincian
                        </Button>
                      </>
                    ) : (
                      <FontStyle fontSize={12}>Belum ada kontrak yang tersedia.</FontStyle>
                    )}
                  </DataPanel>
                </Box>
              ) : null}
            </Box>
          </Box>
        </>
      ) : null}
      <AppModal
        open={!!detail}
        title={detail?.title || "Rincian"}
        description={detail?.description}
        onClose={() => setDetail(null)}
        footer={
          <Button onClick={() => setDetail(null)} sx={{ minHeight: 44 }}>
            Tutup
          </Button>
        }
      >
        <Facts values={detail?.values || []} />
      </AppModal>
    </Box>
  );
}
