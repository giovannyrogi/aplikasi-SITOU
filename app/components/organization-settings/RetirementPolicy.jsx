"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Box, useTheme } from "@mui/material";
import { Alert, Button, Tooltip } from "antd";
import {
  EditOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import PageHeader from "../layout/PageHeader";
import DataPanel from "../data-display/DataPanel";
import FontStyle from "../font-style/FontStyle";
import CompactInfoChip from "../chips/CompactInfoChip";
import OrganizationSelect from "../selects/OrganizationSelect";
import Notification from "../Notifications/Notification";
import RetirementPolicyEditor from "./RetirementPolicyEditor";
import { useAuthenticatedUser } from "../auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "../loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";

/** Ringkasan kebijakan memisahkan informasi berlaku dari sesi perubahan yang dibuka eksplisit. */
export default function RetirementPolicy() {
  const user = useAuthenticatedUser();
  const params = useSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const organizationId =
    user.role_code === "superadmin" ? params.get("organizationId") : String(user.organization_id);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState(null);
  const { startLoading, startNavigationLoading } = useLoadingBackdrop();
  const load = useCallback(
    async (signal) => {
      if (!organizationId) return;
      const finish = startLoading({ message: "Memuat kebijakan pensiun…" });
      try {
        const body = await fetch(
          `/api/organization-settings/retirement?organizationId=${organizationId}`,
          { signal },
        ).then(readApiResponse);
        setData(body.data);
        setError("");
      } catch (cause) {
        if (cause.name !== "AbortError") {
          const message = normalizeRequestError(cause).message;
          setError(message);
          setNotice({ message, severity: "error" });
        }
      } finally {
        finish();
      }
    },
    [organizationId, startLoading],
  );
  useEffect(() => {
    const controller = new AbortController();
    // Efek memulai pembacaan jaringan; state lokal diubah setelah respons selesai.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const current = data?.organization.id === organizationId ? data : null;
  const policy = current?.policy;
  const dateTime = (value) =>
    value
      ? new Date(value).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })
      : "Belum tersedia";

  /** Navigasi laporan tetap mempertahankan organisasi dan lifecycle loading bersama. */
  function openReport() {
    startNavigationLoading();
    router.push(`/reports/retirements?organizationId=${organizationId}`);
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 3, minWidth: 0 }}>
      <PageHeader
        title="Kebijakan pensiun"
        description="Acuan usia pensiun organisasi untuk memantau proyeksi dan mempersiapkan regenerasi pegawai."
        action={
          organizationId ? (
            <Tooltip title="Muat ulang kebijakan">
              <Button
                aria-label="Muat ulang kebijakan"
                icon={<ReloadOutlined />}
                onClick={() => load()}
              >
                Muat ulang
              </Button>
            </Tooltip>
          ) : null
        }
      />
      {user.role_code === "superadmin" && (
        <DataPanel title="Organisasi">
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <OrganizationSelect
              aria-label="Organisasi"
              value={organizationId || undefined}
              onChange={(value) =>
                window.history.replaceState(
                  null,
                  "",
                  `/organization-settings/retirement?organizationId=${encodeURIComponent(value)}`,
                )
              }
              style={{ width: "100%" }}
            />
          </Box>
        </DataPanel>
      )}
      {!organizationId ? (
        <Alert showIcon type="info" title="Pilih organisasi untuk melihat kebijakan pensiun." />
      ) : error ? (
        <Alert
          showIcon
          type="error"
          title={error}
          action={<Button onClick={() => load()}>Coba lagi</Button>}
        />
      ) : (
        current && (
          <>
            <DataPanel title="Kebijakan yang berlaku" description={current.organization.name}>
              <Box
                sx={{
                  p: { xs: 2, sm: 3 },
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0,1fr)",
                    md: "minmax(180px,0.75fr) minmax(0,1.25fr)",
                  },
                  gap: { xs: 3, md: 4 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}
                  >
                    <CalendarOutlined />
                    <FontStyle fontSize={13}>Usia pensiun</FontStyle>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      gap: 1,
                      my: 1,
                    }}
                  >
                    <FontStyle
                      fontSize={policy ? 56 : 28}
                      fontWeight={700}
                      sx={{
                        lineHeight: 1.2,
                        color: policy ? "primary.main" : "text.primary",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {policy?.retirement_age ?? "Belum diatur"}
                    </FontStyle>
                    {policy && (
                      <FontStyle fontSize={18} sx={{ color: "text.secondary" }}>
                        tahun
                      </FontStyle>
                    )}
                  </Box>
                  <CompactInfoChip
                    tone={policy ? "success" : "warning"}
                    icon={policy ? <CheckCircleOutlined /> : undefined}
                    label={policy ? "Kebijakan aktif" : "Perlu ditetapkan"}
                  />
                  {current.canManage ? (
                    <Box sx={{ mt: 3 }}>
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        aria-label={policy ? "Ubah usia pensiun" : "Tetapkan usia pensiun"}
                        onClick={() => setEditor(current)}
                        style={{ minHeight: 44, maxWidth: "100%" }}
                      >
                        {policy ? "Ubah usia pensiun" : "Tetapkan usia pensiun"}
                      </Button>
                    </Box>
                  ) : (
                    <FontStyle fontSize={12} sx={{ mt: 2, color: "text.secondary" }}>
                      Perubahan kebijakan dikelola oleh HRD organisasi.
                    </FontStyle>
                  )}
                </Box>
                <Box
                  sx={{
                    minWidth: 0,
                    pl: { xs: 0, md: 4 },
                    pt: { xs: 3, md: 0 },
                    borderTop: { xs: `1px solid ${theme.ui.panelBorderSubtle}`, md: 0 },
                    borderLeft: { xs: 0, md: `1px solid ${theme.ui.panelBorderSubtle}` },
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr)",
                    gap: 2.5,
                    alignContent: "start",
                  }}
                >
                  <Box>
                    <FontStyle fontSize={13} fontWeight={600}>
                      Dasar perhitungan
                    </FontStyle>
                    <FontStyle
                      fontSize={13}
                      sx={{ mt: 0.5, color: "text.secondary", lineHeight: 1.7 }}
                    >
                      {policy
                        ? `Tanggal lahir + ${policy.retirement_age} tahun. Berlaku untuk seluruh pegawai organisasi dengan hubungan kerja yang masih berjalan.`
                        : "Tetapkan usia pensiun agar dashboard dan laporan dapat menampilkan proyeksi pegawai."}
                    </FontStyle>
                  </Box>
                  {policy && (
                    <Box>
                      <FontStyle fontSize={13} fontWeight={600}>
                        Pembaruan terakhir
                      </FontStyle>
                      <FontStyle fontSize={13} sx={{ mt: 0.5 }}>
                        {dateTime(policy.updated_at)}
                      </FontStyle>
                      <FontStyle fontSize={12} sx={{ mt: 0.5, color: "text.secondary" }}>
                        Oleh {policy.updated_by}
                      </FontStyle>
                    </Box>
                  )}
                  <FontStyle fontSize={12} sx={{ color: "text.secondary", lineHeight: 1.7 }}>
                    Kelahiran 29 Februari menggunakan 28 Februari pada tahun proyeksi nonkabisat.
                    Status pensiun tetap diproses oleh HRD melalui detail pegawai.
                  </FontStyle>
                </Box>
              </Box>
              <Box
                sx={{
                  px: { xs: 2, sm: 3 },
                  py: 2,
                  borderTop: 1,
                  borderColor: "divider",
                  bgcolor: theme.ui.panelSubtleBg,
                  display: "flex",
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                  flexDirection: { xs: "column", sm: "row" },
                  gap: 1.5,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <FontStyle fontSize={13} fontWeight={600}>
                    Pantau pegawai yang mendekati pensiun
                  </FontStyle>
                  <FontStyle fontSize={12} sx={{ mt: 0.5, color: "text.secondary" }}>
                    Lihat tanggal proyeksi dan sisa waktu berdasarkan kebijakan ini.
                  </FontStyle>
                </Box>
                <Button
                  disabled={!policy}
                  icon={<ArrowRightOutlined />}
                  onClick={openReport}
                  style={{ minHeight: 44, flexShrink: 0 }}
                >
                  Lihat proyeksi pensiun
                </Button>
              </Box>
            </DataPanel>
            <DataPanel
              title="Riwayat perubahan"
              description="Jejak usia sebelumnya, alasan perubahan, dan pengguna yang menetapkannya. Maksimal 20 perubahan terakhir."
            >
              <Box
                component="ol"
                sx={{
                  m: 0,
                  p: { xs: 2, sm: 3 },
                  listStyle: "none",
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr)",
                  gap: 0,
                }}
              >
                {current.history.length ? (
                  current.history.map((entry, index) => (
                    <Box
                      component="li"
                      key={entry.id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "32px minmax(0,1fr)",
                        gap: 1.5,
                        pt: index ? 2 : 0,
                        pb: 2,
                        borderBottom: index < current.history.length - 1 ? 1 : 0,
                        borderColor: "divider",
                      }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          placeItems: "center",
                          width: 32,
                          height: 32,
                          borderRadius: 1,
                          bgcolor: theme.ui.panelSubtleBg,
                          color: "text.secondary",
                        }}
                      >
                        <HistoryOutlined />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            gap: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <FontStyle fontSize={14} fontWeight={600}>
                            {entry.before_data?.retirement_age
                              ? `${entry.before_data.retirement_age} → `
                              : "Ditetapkan: "}
                            {entry.after_data.retirement_age} tahun
                          </FontStyle>
                          <FontStyle fontSize={11.5} sx={{ color: "text.secondary" }}>
                            {dateTime(entry.occurred_at)}
                          </FontStyle>
                        </Box>
                        <FontStyle fontSize={13} sx={{ mt: 0.75, lineHeight: 1.7 }}>
                          {entry.after_data.reason}
                        </FontStyle>
                        <FontStyle fontSize={12} sx={{ mt: 0.75, color: "text.secondary" }}>
                          Oleh {entry.actor_name}
                        </FontStyle>
                      </Box>
                    </Box>
                  ))
                ) : (
                  <FontStyle
                    component="li"
                    fontSize={13}
                    sx={{ color: "text.secondary", lineHeight: 1.7 }}
                  >
                    {policy
                      ? "Belum ada perubahan setelah kebijakan awal ditetapkan."
                      : "Riwayat akan tersedia setelah usia pensiun ditetapkan."}
                  </FontStyle>
                )}
              </Box>
            </DataPanel>
          </>
        )
      )}
      {editor && (
        <RetirementPolicyEditor
          organization={editor.organization}
          policy={editor.policy}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setNotice({
              message:
                "Kebijakan pensiun tersimpan. Proyeksi mengikuti usia terbaru saat dimuat ulang.",
              severity: "success",
            });
            load();
          }}
        />
      )}
      <Notification
        open={!!notice}
        message={notice?.message || ""}
        severity={notice?.severity || "info"}
        onClose={() => setNotice(null)}
      />
    </Box>
  );
}
