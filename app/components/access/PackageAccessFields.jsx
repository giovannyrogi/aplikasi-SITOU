"use client";
import { Button, Form, Select, Input } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import PrerequisiteHint from "@/app/components/forms/PrerequisiteHint";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { accessFeatureDescription } from "@/lib/access/featureLabels.mjs";
import FontStyle from "@/app/components/font-style/FontStyle";
import AccessExplanation from "./AccessExplanation";
import { SCOPE_DESCRIPTIONS, FEATURE_DESCRIPTIONS } from "@/lib/access/accessDescriptions.mjs";

function PackageRow({
  field,
  form,
  options,
  existing,
  onRemove,
  organizationId,
  onNavigate,
  canReadWarehouses,
  optionsReady,
}) {
  const scopeMode = Form.useWatch(["packageAccess", field.name, "scopeMode"], form);
  const grants = Form.useWatch("packageAccess", form) || [];
  const isMaster = grants[field.name]?.packageCode === "inventory_master";
  const locked = options.lockedPackageCodes?.includes(grants[field.name]?.packageCode);
  const warehouseOptions = [...options.warehouses];
  for (const grant of existing || [])
    for (const warehouse of grant.warehouses || [])
      if (!warehouseOptions.some((w) => w.id === warehouse.id))
        warehouseOptions.push({ ...warehouse, disabled: true });
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr)",
        "& .ant-form-item": { minWidth: 0 },
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
          gap: 2,
          minWidth: 0,
          "& .ant-form-item": { minWidth: 0 },
        }}
      >
        <Form.Item
          name={[field.name, "packageCode"]}
          label="Fitur dan izin"
          extra={
            optionsReady ? (
              <AccessExplanation title="Kemampuan dan batas izin">
                {accessFeatureDescription(grants[field.name]?.packageCode) ||
                  "Pilih izin sesuai tugas akun: Lihat Saja, Pengelola Gudang, atau Pengelola Master Inventaris."}
              </AccessExplanation>
            ) : undefined
          }
          rules={[{ required: true, message: "Pilih fitur dan izin pengguna." }]}
        >
          <Select
            disabled={!optionsReady || !options.inventoryEnabled || locked}
            onChange={(code) => {
              if (code === "inventory_master") {
                form.setFieldValue(["packageAccess", field.name, "scopeMode"], "all");
                form.setFieldValue(["packageAccess", field.name, "warehouseIds"], []);
              } else if (isMaster) {
                form.setFieldValue(["packageAccess", field.name, "scopeMode"], "selected");
                form.setFieldValue(["packageAccess", field.name, "warehouseIds"], []);
              }
            }}
            options={options.packages.map((p) => ({
              value: p.code,
              label: p.name,
              disabled:
                p.disabled ||
                grants.some(
                  (grant, index) => index !== field.name && grant?.packageCode === p.code,
                ),
            }))}
          />
        </Form.Item>
        {isMaster ? (
          <>
            <Form.Item name={[field.name, "scopeMode"]} hidden>
              <Input />
            </Form.Item>
            <Form.Item label="Cakupan akses">
              <FontStyle explanation fontSize={12}>
                {SCOPE_DESCRIPTIONS.master}
              </FontStyle>
            </Form.Item>
          </>
        ) : (
          <Form.Item
            name={[field.name, "scopeMode"]}
            label="Cakupan gudang"
            rules={[{ required: true }]}
            extra={
              <FontStyle explanation fontSize={12}>
                {SCOPE_DESCRIPTIONS[scopeMode] || "Pilih cakupan gudang untuk akses ini."}
              </FontStyle>
            }
          >
            <Select
              disabled={!optionsReady || !options.inventoryEnabled || locked}
              onChange={(mode) => {
                if (mode === "all")
                  form.setFieldValue(["packageAccess", field.name, "warehouseIds"], []);
              }}
              options={[
                { value: "selected", label: "Pilih Gudang" },
                {
                  value: "all",
                  label: "Seluruh gudang organisasi",
                  disabled: !options.canGrantAll,
                },
              ]}
            />
          </Form.Item>
        )}
      </Box>
      {!isMaster && scopeMode === "selected" ? (
        <Form.Item
          name={[field.name, "warehouseIds"]}
          label="Gudang yang dapat diakses"
          extra={
            optionsReady && !options.warehouses.length ? (
              <PrerequisiteHint
                text="Belum ada gudang aktif dalam cakupan pemberian akses Anda. Minta Superadmin atau Pengelola Master Inventaris menyiapkannya melalui Data Master → Gudang."
                href={
                  canReadWarehouses && organizationId
                    ? `/master-data/inventory-warehouses?organizationId=${organizationId}`
                    : undefined
                }
                onNavigate={onNavigate}
                linkLabel="Buka Gudang"
              />
            ) : undefined
          }
          rules={[{ required: true, type: "array", min: 1, message: "Pilih minimal satu gudang." }]}
        >
          <Select
            mode="multiple"
            notFoundContent="Tidak ada gudang yang sesuai."
            disabled={!optionsReady || !options.inventoryEnabled || locked}
            showSearch
            optionFilterProp="label"
            options={warehouseOptions.map((w) => ({
              value: w.id,
              label: `${w.name} · ${w.location_name}${w.is_active === false ? " (Nonaktif)" : ""}`,
              disabled: w.disabled,
            }))}
          />
        </Form.Item>
      ) : null}
      {locked ? (
        <FontStyle explanation fontSize={12} sx={{ color: "text.secondary" }}>
          Akses ini di luar kewenangan Anda. Minta Superadmin atau HRD seluruh lokasi mengubahnya.
        </FontStyle>
      ) : null}
      <Button
        disabled={locked}
        danger
        icon={<DeleteOutlined />}
        onClick={onRemove}
        style={{ justifySelf: "start" }}
      >
        Hapus izin Inventaris
      </Button>
    </Box>
  );
}
export default function PackageAccessFields({
  form,
  options,
  existing,
  organizationId,
  onNavigate,
  optionsReady,
  embedded = false,
  onDirty,
}) {
  const user = useAuthenticatedUser();
  const assigned = Form.useWatch("packageAccess", form) || [];
  const canReadWarehouses =
    user.role_code === "superadmin" ||
    (user.access?.permissions?.includes("inventory.master.read") &&
      user.access?.permissions?.includes("inventory.warehouses.read"));
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr)",
        gap: 2,
        my: embedded ? 0 : 3,
        minWidth: 0,
      }}
    >
      {!embedded ? (
        <FontStyle component="h3" fontWeight={700}>
          Akses fitur
        </FontStyle>
      ) : null}
      <FontStyle explanation fontSize={12} sx={{ color: "text.secondary" }}>
        {FEATURE_DESCRIPTIONS.inventory}
      </FontStyle>
      <FontStyle explanation fontSize={12} sx={{ color: "text.secondary" }}>
        Gudang disiapkan melalui Data Master → Gudang oleh Superadmin atau Pengelola Master
        Inventaris.
      </FontStyle>
      {optionsReady && !options.inventoryEnabled ? (
        <FontStyle explanation fontSize={12}>
          Fitur Inventaris belum aktif. Minta Superadmin mengaktifkannya. Pengaturan akses
          sebelumnya tetap tersimpan.
        </FontStyle>
      ) : null}
      <Form.List name="packageAccess">
        {(fields, { add, remove }) => (
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 2, minWidth: 0 }}>
            {fields.map((field) => (
              <PackageRow
                key={field.key}
                field={field}
                organizationId={organizationId}
                onNavigate={onNavigate}
                canReadWarehouses={canReadWarehouses}
                optionsReady={optionsReady}
                form={form}
                options={options}
                existing={existing}
                onRemove={() => {
                  remove(field.name);
                  onDirty?.();
                }}
              />
            ))}
            {options.packages.some(
              (option) =>
                !option.disabled && !assigned.some((grant) => grant?.packageCode === option.code),
            ) ? (
              <Button
                icon={<PlusOutlined />}
                disabled={!optionsReady || !options.inventoryEnabled}
                onClick={() => {
                  add({ scopeMode: "selected", warehouseIds: [] });
                  onDirty?.();
                }}
                style={{ justifySelf: "start" }}
              >
                Tambahkan izin Inventaris
              </Button>
            ) : null}
          </Box>
        )}
      </Form.List>
    </Box>
  );
}
