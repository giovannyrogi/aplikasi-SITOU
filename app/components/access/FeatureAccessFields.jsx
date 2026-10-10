"use client";
import { Button, Collapse, Form, Select } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppIcon from "@/app/components/icons/AppIcon";
import HrisAccessFields from "./HrisAccessFields";
import PackageAccessFields from "./PackageAccessFields";
import { accountFeatureGroups, accessScopeSummary } from "@/lib/access/accessDescriptions.mjs";
/** State presentasi fitur mengikuti reset/dirty lifecycle Form. */
function FeatureValue() {
  return null;
}
/** Satu pengaturan fitur, dengan grant HRIS/Inventaris tetap terpisah. */
export default function FeatureAccessFields({
  form,
  roleCode,
  item,
  options,
  optionsReady,
  onDirty,
  organizationId,
  onNavigate,
}) {
  const selected = Form.useWatch("featureModules", form) || [];
  const expanded = Form.useWatch("expandedFeatureSections", form) || [];
  const hrisGrants = Form.useWatch("hrisMenuAccess", form) || [];
  const accountMode = Form.useWatch("hrisAccountAccess", form) || "none";
  const inventoryGrants = Form.useWatch("packageAccess", form) || [];
  const full = Form.useWatch("isHrisAdmin", form);
  const canHris = optionsReady && options.canGrantHris && roleCode === "hrd";
  const canInventory = optionsReady && options.canDelegateNonHris;
  const showHris = canHris && (selected.includes("hris") || full);
  const showInventory = canInventory && selected.includes("inventory");
  const addFeature = (code) => {
    form.setFieldValue("featureModules", [...new Set([...selected, code])]);
    if (code === "inventory" && !(form.getFieldValue("packageAccess") || []).length)
      form.setFieldValue("packageAccess", [{ scopeMode: "selected", warehouseIds: [] }]);
    form.setFieldValue("expandedFeatureSections", [...new Set([...expanded, code])]);
    onDirty();
  };
  const removeFeature = (code) => {
    form.setFieldValue(
      "featureModules",
      selected.filter((value) => value !== code),
    );
    if (code === "hris") {
      form.setFieldValue("hrisMenuAccess", []);
      form.setFieldValue("hrisAccountAccess", "none");
    } else form.setFieldValue("packageAccess", []);
    onDirty();
  };
  const available = [
    ...(canHris && !showHris ? [{ value: "hris", label: "HRIS" }] : []),
    ...(canInventory && !showInventory
      ? [{ value: "inventory", label: "Inventaris", disabled: !options.inventoryEnabled }]
      : []),
  ];
  const saved = accountFeatureGroups(item || {});
  return (
    <Box sx={{ display: "grid", gap: 3, my: 3, minWidth: 0, "& > .ant-form-item": { mb: 0 } }}>
      <Form.Item name="featureModules" hidden>
        <FeatureValue />
      </Form.Item>
      <Box sx={{ display: "grid", gap: 1 }}>
        <FontStyle component="h3" fontWeight={700}>
          Akses fitur
        </FontStyle>
        <FontStyle explanation fontSize={12}>
          Pilih fitur, izin, dan cakupan akses akun ini.
        </FontStyle>
      </Box>
      {!optionsReady ? (
        <FontStyle explanation fontSize={12}>
          Referensi akses fitur belum tersedia. Penyimpanan dibuka setelah data berhasil dimuat.
        </FontStyle>
      ) : null}
      {canHris && !options.hrisConfigured && !showHris ? (
        <FontStyle explanation fontSize={12}>
          Tetapkan admin HRD penuh melalui fitur HRIS untuk mengaktifkan pembagian hak menu
          organisasi.
        </FontStyle>
      ) : null}
      {available.length ? (
        <Form.Item
          label="Tambahkan fitur"
          extra={
            !optionsReady
              ? "Referensi fitur sedang dimuat."
              : !options.inventoryEnabled
                ? "Inventaris belum aktif. Minta Superadmin mengaktifkannya."
                : canHris
                  ? "HRIS mengatur administrasi Pegawai. Inventaris mengatur persediaan dan gudang."
                  : "Inventaris mengatur persediaan dan gudang sesuai izin yang diberikan."
          }
        >
          <Select
            aria-label="Tambahkan fitur"
            value={null}
            placeholder="Pilih fitur yang ingin diberikan"
            disabled={!optionsReady}
            options={available}
            onChange={addFeature}
          />
        </Form.Item>
      ) : null}
      <Form.Item name="expandedFeatureSections" hidden>
        <FeatureValue />
      </Form.Item>
      <Collapse
        style={{ width: "100%", minWidth: 0 }}
        activeKey={expanded}
        onChange={(keys) => form.setFieldValue("expandedFeatureSections", keys)}
        expandIconPlacement="end"
        items={[
          ...(showHris ? [{ code: "hris", label: "HRIS", icon: "navigation:employees" }] : []),
          ...(showInventory
            ? [{ code: "inventory", label: "Inventaris", icon: "navigation:inventory" }]
            : []),
        ].map((feature) => ({
          key: feature.code,
          forceRender: true,
          label: (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                minWidth: 0,
                flexWrap: "wrap",
              }}
            >
              <AppIcon icon={feature.icon} fontSize="22px" />
              <Box sx={{ minWidth: 0 }}>
                <FontStyle component="h4" fontWeight={700}>
                  {feature.label}
                </FontStyle>
                <FontStyle fontSize={12} color="text.secondary">
                  {feature.code === "hris"
                    ? full
                      ? "Admin HRD penuh"
                      : `${hrisGrants.filter((grant) => grant.key !== "dashboard").length + (accountMode !== "none" ? 1 : 0)} menu dipilih`
                    : `${inventoryGrants.length} izin Inventaris`}
                </FontStyle>
              </Box>
            </Box>
          ),
          children: (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr)",
                gap: 3,
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
              {feature.code === "hris" ? (
                <HrisAccessFields form={form} item={item} options={options} onDirty={onDirty} />
              ) : (
                <PackageAccessFields
                  form={form}
                  options={options}
                  optionsReady={optionsReady}
                  existing={item?.packageAccess}
                  organizationId={organizationId}
                  onNavigate={onNavigate}
                  onDirty={onDirty}
                  embedded
                />
              )}
              {!(feature.code === "hris" && full) ? (
                <Box sx={{ pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Cabut fitur ${feature.label}`}
                    onClick={() => removeFeature(feature.code)}
                  >
                    Cabut akses {feature.label}
                  </Button>
                </Box>
              ) : null}
            </Box>
          ),
        }))}
      />
      {optionsReady && !canInventory && saved.some((feature) => feature.key === "inventory") ? (
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <FontStyle fontWeight={600}>Inventaris · Akses tersimpan</FontStyle>
          <FontStyle explanation fontSize={12}>
            Anda hanya mengelola akun Pegawai. Perubahan akses fitur dilakukan oleh admin HRD penuh
            atau HRD dengan izin delegasi.
          </FontStyle>
          {item.packageAccess.map((grant) => (
            <Box key={grant.packageCode}>
              <FontStyle fontSize={12}>{grant.name}</FontStyle>
              <FontStyle explanation fontSize={12}>
                {accessScopeSummary(grant)}
              </FontStyle>
            </Box>
          ))}
        </Box>
      ) : null}
      {optionsReady && !available.length && !showHris && !showInventory && !saved.length ? (
        <FontStyle explanation fontSize={12}>
          Akun ini belum memiliki akses fitur tambahan.
        </FontStyle>
      ) : null}
    </Box>
  );
}
