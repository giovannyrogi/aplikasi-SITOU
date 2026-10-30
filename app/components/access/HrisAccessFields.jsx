"use client";
import { Checkbox, Collapse, Form, Select } from "antd";
import { Box } from "@mui/material";
import { HRIS_MENUS } from "@/lib/access/hrisPolicy.mjs";
import {
  ACCOUNT_ACCESS_OPTIONS,
  hrisMenuAccessDescription,
  FEATURE_DESCRIPTIONS,
} from "@/lib/access/accessDescriptions.mjs";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import AppIcon from "@/app/components/icons/AppIcon";
import AppNotice from "@/app/components/data-display/AppNotice";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import AccessExplanation from "./AccessExplanation";
/** Menjaga array grant sebagai nilai Form, bukan string input HTML. */
function GrantValue() {
  return null;
}
const groupIcons = {
  Dashboard: "navigation:dashboard",
  "Data Master": "navigation:master-data",
  Kepegawaian: "navigation:employees",
  Laporan: "navigation:reports",
  "Pengaturan Organisasi": "navigation:organization-settings",
  "Akun & Akses": "navigation:organization-account",
};
/** Editor HRIS hanya dipasang bagi pemberi berizin; backend memeriksa kembali. */
export default function HrisAccessFields({ form, item, options, onDirty }) {
  const assigned = Form.useWatch("hrisMenuAccess", form) || [];
  const expandedGroups = Form.useWatch("expandedHrisGroups", form) || ["Kepegawaian"];
  const full = Form.useWatch("isHrisAdmin", form) ?? item?.hrisAccess?.fullAdmin;
  const accountAccess = Form.useWatch("hrisAccountAccess", form) || "none";
  const change = (next) => {
    form.setFieldValue("hrisMenuAccess", next);
    onDirty();
  };
  const menuDefinitions = HRIS_MENUS.filter((menu) => menu.assignable);
  const groups = [...new Set(menuDefinitions.map((menu) => menu.group)), "Akun & Akses"];
  const setAccountAccess = (mode) => {
    form.setFieldValue("hrisAccountAccess", mode);
    onDirty();
  };
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        minWidth: 0,
        "& > .form-setting-switch": { py: 0 },
        "& .ant-checkbox-wrapper": { minHeight: 44, alignItems: "center" },
      }}
    >
      {!full ? (
        <FontStyle explanation fontSize={12}>
          {FEATURE_DESCRIPTIONS.hris}
        </FontStyle>
      ) : null}
      {options.attendanceEnabled === false ? (
        <AppNotice
          compact
          title="Fitur Absensi belum aktif"
          description="Hak Jadwal Kerja, Kalender Libur dan Jadwal Pegawai baru dapat digunakan setelah Superadmin mengaktifkan Fitur Absensi organisasi. Hak yang sudah diberikan tetap tersimpan."
        />
      ) : null}
      {options.canSetHrisAdmin ? (
        <FormSettingSwitch
          name="isHrisAdmin"
          title="Admin HRD penuh"
          description="Hanya satu akun per organisasi. Aktifkan untuk menetapkan akun ini; nonaktifkan untuk mencabut hak penuhnya."
        />
      ) : null}
      <Form.Item name="expandedHrisGroups" hidden>
        <GrantValue />
      </Form.Item>
      <Form.Item name="hrisMenuAccess" hidden>
        <GrantValue />
      </Form.Item>
      {!options.hasFullHrisAdmin && !full ? (
        <FontStyle explanation fontSize={12}>
          Belum ada admin HRD penuh. Hak menu yang diberikan langsung tetap berlaku.
        </FontStyle>
      ) : null}
      {full ? (
        <AppNotice
          compact
          tone="info"
          title="Akses HRIS lengkap"
          description="Dapat mengelola menu HRIS pada fitur organisasi yang aktif, seluruh lokasi, dan akun organisasi. Fitur Absensi harus diaktifkan Superadmin. Akses Inventaris diberikan terpisah."
        />
      ) : (
        <>
          <Collapse
            activeKey={expandedGroups}
            onChange={(keys) => form.setFieldValue("expandedHrisGroups", keys)}
            items={groups.map((group) => {
              const accountGroup = group === "Akun & Akses";
              const menus = accountGroup
                ? [{ key: "organization-accounts", label: "Akun Organisasi", canManage: true }]
                : menuDefinitions.filter((menu) => menu.group === group);
              const selected = menus.filter((menu) =>
                accountGroup
                  ? accountAccess !== "none"
                  : assigned.some((grant) => grant.key === menu.key),
              );
              return {
                key: group,
                forceRender: true,
                label: (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 1.5,
                      minWidth: 0,
                    }}
                  >
                    <AppIcon icon={groupIcons[group]} fontSize="20px" />
                    <FontStyle component="span" fontWeight={700}>
                      {group}
                    </FontStyle>
                    <CompactInfoChip
                      label={`${selected.length}/${menus.length} menu`}
                      tone="neutral"
                    />
                  </Box>
                ),
                children: (
                  <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
                    {menus.length > 1 ? (
                      <Checkbox
                        checked={selected.length === menus.length}
                        indeterminate={selected.length > 0 && selected.length < menus.length}
                        onChange={(e) =>
                          change([
                            ...assigned.filter((g) => !menus.some((m) => m.key === g.key)),
                            ...(e.target.checked
                              ? menus.map((m) => ({
                                  key: m.key,
                                  level: m.canManage ? "manage" : "read",
                                }))
                              : []),
                          ])
                        }
                      >
                        Pilih semua menu {group}
                      </Checkbox>
                    ) : null}
                    {menus.map((menu, index) => {
                      const grant = accountGroup
                        ? accountAccess !== "none"
                          ? { level: accountAccess }
                          : null
                        : assigned.find((g) => g.key === menu.key);
                      return (
                        <Box
                          key={menu.key}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0,1fr)",
                            gap: 2,
                            minWidth: 0,
                            maxWidth: "100%",
                            borderTop: index > 0 ? "1px solid" : undefined,
                            borderColor: "divider",
                            pt: index > 0 ? 3 : 0,
                          }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Checkbox
                              checked={Boolean(grant)}
                              onChange={(e) =>
                                accountGroup
                                  ? setAccountAccess(e.target.checked ? "manage" : "none")
                                  : change([
                                      ...assigned.filter((g) => g.key !== menu.key),
                                      ...(e.target.checked
                                        ? [
                                            {
                                              key: menu.key,
                                              level: menu.canManage ? "manage" : "read",
                                            },
                                          ]
                                        : []),
                                    ])
                              }
                            >
                              {menu.label}
                            </Checkbox>
                          </Box>
                          <Box sx={{ display: "grid", gap: 1, alignContent: "start", minWidth: 0 }}>
                            {menu.canManage ? (
                              <Select
                                aria-label={`Tingkat akses ${menu.label}`}
                                style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}
                                popupMatchSelectWidth
                                popupRender={(node) => (
                                  <Box
                                    sx={{
                                      maxWidth: "100%",
                                      "& .ant-select-item-option-content": {
                                        whiteSpace: "normal",
                                        overflowWrap: "anywhere",
                                        lineHeight: 1.6,
                                      },
                                    }}
                                  >
                                    {node}
                                  </Box>
                                )}
                                styles={{
                                  popup: { root: { maxWidth: "calc(100vw - 32px)" } },
                                  option: { whiteSpace: "normal", overflowWrap: "anywhere" },
                                }}
                                disabled={!grant}
                                value={grant?.level || (accountGroup ? "manage" : "read")}
                                onChange={(level) =>
                                  accountGroup
                                    ? setAccountAccess(level)
                                    : change(
                                        assigned.map((g) =>
                                          g.key === menu.key ? { ...g, level } : g,
                                        ),
                                      )
                                }
                                options={
                                  accountGroup
                                    ? ACCOUNT_ACCESS_OPTIONS.filter(
                                        (option) => option.value !== "none",
                                      ).map(({ value, label }) => ({ value, label }))
                                    : [
                                        { value: "read", label: "Lihat Saja" },
                                        ...(menu.canManage
                                          ? [{ value: "manage", label: "Kelola" }]
                                          : []),
                                      ]
                                }
                              />
                            ) : (
                              <CompactInfoChip
                                label="Hanya baca"
                                tone="neutral"
                                icon={<AppIcon icon="solar:eye-linear" />}
                                sx={{ justifySelf: "start" }}
                              />
                            )}
                            <AccessExplanation
                              title={menu.canManage ? "Batas izin" : "Jenis akses"}
                            >
                              {grant
                                ? accountGroup
                                  ? ACCOUNT_ACCESS_OPTIONS.find(
                                      (option) => option.value === accountAccess,
                                    )?.description
                                  : hrisMenuAccessDescription(menu.key, grant.level)
                                : "Centang menu untuk memberikan akses."}
                              {accountGroup && grant
                                ? " HRIS hanya dapat diberikan oleh admin penuh atau Superadmin."
                                : ""}
                            </AccessExplanation>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                ),
              };
            })}
          />
          <Form.Item name="hrisAccountAccess" hidden>
            <GrantValue />
          </Form.Item>
        </>
      )}
    </Box>
  );
}
