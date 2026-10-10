"use client";
import { useEffect, useState } from "react";
import { Button, Skeleton } from "antd";
import { Box } from "@mui/material";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppModal from "@/app/components/modals/AppModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppIcon from "@/app/components/icons/AppIcon";
import ErrorState from "@/app/components/data-display/ErrorState";
import { readApiResponse } from "@/lib/api/clientError";
import { HRIS_MENUS } from "@/lib/access/hrisPolicy.mjs";
import {
  accountFeatureGroups,
  accessScopeSummary,
  HRIS_MENU_DESCRIPTIONS,
  ACCESS_LEVEL_DESCRIPTIONS,
  ACCOUNT_ACCESS_OPTIONS,
  SCOPE_DESCRIPTIONS,
} from "@/lib/access/accessDescriptions.mjs";
import { accessFeatureDescription } from "@/lib/access/featureLabels.mjs";
import AccessExplanation from "./AccessExplanation";
/** Ringkasan noninteraktif; fitur yang sama dihitung sekali meski mempunyai beberapa izin. */
export default function AccountAccessSummary({ account }) {
  const groups = accountFeatureGroups(account);
  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, minWidth: 0 }}>
      {groups.length ? (
        <>
          <CompactInfoChip
            label={groups[0].label}
            icon={<AppIcon icon={groups[0].icon} />}
            tone="info"
          />
          {groups.length > 1 ? (
            <FontStyle fontSize={12} color="text.secondary">
              +{groups.length - 1} fitur lainnya
            </FontStyle>
          ) : null}
        </>
      ) : (
        <FontStyle fontSize={12} color="text.secondary">
          Tanpa akses fitur tambahan
        </FontStyle>
      )}
    </Box>
  );
}
/** Identitas section dengan ikon, hierarchy judul dan chip selebar isinya. */
function FeatureHeading({ icon, title, status }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", minWidth: 0 }}>
      <Box sx={{ p: 1, display: "flex", borderRadius: 1, bgcolor: "action.hover" }}>
        <AppIcon icon={icon} fontSize="22px" />
      </Box>
      <FontStyle component="h3" fontWeight={700} sx={{ flex: 1 }}>
        {title}
      </FontStyle>
      <CompactInfoChip
        label={status === false ? "Fitur nonaktif" : "Fitur aktif"}
        tone={status === false ? "neutral" : "success"}
      />
    </Box>
  );
}
/** Modal di level halaman: tidak hilang saat tabel desktop berganti kartu mobile. */
export function AccountAccessDetails({ account, onClose }) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setState({ loading: true, data: null, error: "" });
    });
    fetch(`/api/access/accounts/${account.id}?organizationId=${account.organization_id}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(readApiResponse)
      .then((body) => {
        if (!controller.signal.aborted) setState({ loading: false, data: body.data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [revision, account.id, account.organization_id]);
  const value = state.data;
  const groups = value ? accountFeatureGroups(value) : [];
  return (
    <AppModal
      open
      title="Detail hak akses"
      description="Fitur, izin, dan cakupan akses akun."
      icon="navigation:access"
      size="lg"
      onClose={onClose}
      footer={<Button onClick={onClose}>Tutup</Button>}
    >
      {state.loading ? (
        <Skeleton active />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={() => setRevision((n) => n + 1)} />
      ) : value ? (
        <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
              pb: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <AppIcon icon="navigation:organization-account" fontSize="24px" />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <FontStyle fontWeight={700}>{value.display_name || value.username}</FontStyle>
              <FontStyle fontSize={12} color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                @{value.username} · {value.role_name} · {value.organization_name}
              </FontStyle>
            </Box>
            <CompactInfoChip status={value.is_active ? "active" : "inactive"} />
          </Box>
          {!value.is_active ? (
            <FontStyle explanation fontSize={12}>
              Akun nonaktif. Akses berikut tersimpan dan belum dapat digunakan.
            </FontStyle>
          ) : null}
          {groups.some((group) => group.key === "hris") ? (
            <Box sx={{ display: "grid", gap: 2, minWidth: 0 }}>
              <FeatureHeading icon="navigation:employees" title="HRIS" />
              <FontStyle explanation fontSize={12}>
                Cakupan:{" "}
                {value.location_scope_mode === "all"
                  ? "Seluruh lokasi"
                  : (value.locations || []).map((location) => location.name).join(", ") ||
                    "Lokasi terpilih"}
                .
              </FontStyle>
              {value.hrisAccess.fullAdmin ? (
                <Box sx={{ display: "grid", gap: 1, justifyItems: "start" }}>
                  <CompactInfoChip label="Admin HRD penuh" tone="info" />
                  <FontStyle explanation fontSize={12}>
                    Mengelola seluruh menu HRIS, akun organisasi, dan pembagian akses. Inventaris
                    tetap diatur terpisah.
                  </FontStyle>
                </Box>
              ) : null}
              {value.hrisAccess.legacy ? (
                <FontStyle explanation fontSize={12}>
                  Hak HRD lama masih berlaku sampai Superadmin menetapkan admin penuh.
                </FontStyle>
              ) : null}
              {[
                ...new Set(
                  value.hrisAccess.grants
                    .filter((grant) => grant.key !== "dashboard")
                    .map((grant) => HRIS_MENUS.find((menu) => menu.key === grant.key)?.group),
                ),
              ]
                .filter(Boolean)
                .map((group) => (
                  <Box
                    key={group}
                    sx={{
                      display: "grid",
                      gap: 2,
                      pt: 2,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      minWidth: 0,
                    }}
                  >
                    <FontStyle component="h4" fontWeight={700}>
                      {group}
                    </FontStyle>
                    {value.hrisAccess.grants
                      .filter(
                        (grant) =>
                          HRIS_MENUS.find((menu) => menu.key === grant.key)?.group === group,
                      )
                      .map((grant) => {
                        const menu = HRIS_MENUS.find((entry) => entry.key === grant.key);
                        return (
                          <Box
                            key={grant.key}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: {
                                xs: "minmax(0,1fr)",
                                sm: "minmax(0,1fr) 210px",
                              },
                              gap: 2,
                              minWidth: 0,
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <FontStyle fontWeight={600}>{menu.label}</FontStyle>
                              <FontStyle
                                explanation
                                fontSize={12}
                                color="text.secondary"
                                sx={{ mt: 1 }}
                              >
                                {HRIS_MENU_DESCRIPTIONS[menu.key]}
                              </FontStyle>
                            </Box>
                            <Box
                              sx={{
                                display: "grid",
                                gap: 1,
                                justifyItems: "start",
                                alignContent: "start",
                                minWidth: 0,
                              }}
                            >
                              <CompactInfoChip
                                label={grant.level === "manage" ? "Kelola" : "Lihat Saja"}
                                tone={grant.level === "manage" ? "info" : "neutral"}
                              />
                              <AccessExplanation title="Batas izin">
                                {ACCESS_LEVEL_DESCRIPTIONS[grant.level]}
                              </AccessExplanation>
                            </Box>
                          </Box>
                        );
                      })}
                  </Box>
                ))}
              {!value.hrisAccess.fullAdmin && value.hrisAccess.accountAccess !== "none" ? (
                <Box
                  sx={{
                    display: "grid",
                    gap: 1,
                    pt: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    justifyItems: "start",
                  }}
                >
                  <FontStyle fontWeight={700}>Akun Organisasi</FontStyle>
                  <CompactInfoChip
                    label={
                      ACCOUNT_ACCESS_OPTIONS.find(
                        (option) => option.value === value.hrisAccess.accountAccess,
                      )?.label
                    }
                    tone="info"
                  />
                  <FontStyle explanation fontSize={12}>
                    {
                      ACCOUNT_ACCESS_OPTIONS.find(
                        (option) => option.value === value.hrisAccess.accountAccess,
                      )?.description
                    }
                  </FontStyle>
                </Box>
              ) : null}
            </Box>
          ) : null}
          {value.packageAccess?.length ? (
            <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
              <FeatureHeading
                icon="navigation:inventory"
                title="Inventaris"
                status={value.packageAccess[0].module_enabled}
              />
              {value.packageAccess.map((grant) => (
                <Box
                  key={grant.packageCode}
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    pt: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <AppIcon
                      icon={
                        grant.packageCode === "inventory_master"
                          ? "navigation:master-data"
                          : "navigation:inventory-warehouse"
                      }
                      fontSize="20px"
                    />
                    <FontStyle fontWeight={600}>
                      {grant.name.replace(/^Fitur Inventaris — /, "")}
                    </FontStyle>
                  </Box>
                  <FontStyle explanation fontSize={12}>
                    {accessFeatureDescription(grant.packageCode)}
                  </FontStyle>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                    <FontStyle fontSize={12} fontWeight={600}>
                      Cakupan
                    </FontStyle>
                    <CompactInfoChip
                      label={
                        grant.packageCode === "inventory_master"
                          ? "Organisasi"
                          : grant.scopeMode === "all"
                            ? "Seluruh gudang"
                            : "Pilih Gudang"
                      }
                      tone="neutral"
                    />
                  </Box>
                  <FontStyle explanation fontSize={12} color="text.secondary">
                    {accessScopeSummary(grant)}.{" "}
                    {grant.scopeMode === "all"
                      ? SCOPE_DESCRIPTIONS[
                          grant.packageCode === "inventory_master" ? "master" : "all"
                        ]
                      : ""}
                  </FontStyle>
                </Box>
              ))}
              {value.packageAccess[0].module_enabled === false ? (
                <FontStyle explanation fontSize={12}>
                  Inventaris nonaktif. Pemberian akses tetap tersimpan dan dapat digunakan kembali
                  setelah fitur diaktifkan.
                </FontStyle>
              ) : null}
            </Box>
          ) : null}
          {!groups.length ? (
            <FontStyle explanation>Akun ini belum memiliki akses fitur tambahan.</FontStyle>
          ) : null}
        </Box>
      ) : null}
    </AppModal>
  );
}
