"use client";
import { Button, Form, Select } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

function PackageRow({ field, form, options, existing, onRemove }) {
  const scopeMode = Form.useWatch(["packageAccess", field.name, "scopeMode"], form);
  const grants = Form.useWatch("packageAccess", form) || [];
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
          label="Paket akses"
          rules={[{ required: true, message: "Pilih paket akses." }]}
        >
          <Select
            disabled={!options.inventoryEnabled || locked}
            options={options.packages.map((p) => ({
              value: p.code,
              label: p.name,
              disabled: grants.some(
                (grant, index) => index !== field.name && grant?.packageCode === p.code,
              ),
            }))}
          />
        </Form.Item>
        <Form.Item
          name={[field.name, "scopeMode"]}
          label="Cakupan gudang"
          rules={[{ required: true }]}
          extra={
            scopeMode === "all"
              ? "Mencakup seluruh gudang sekarang dan gudang baru berikutnya."
              : undefined
          }
        >
          <Select
            disabled={!options.inventoryEnabled || locked}
            onChange={(mode) => {
              if (mode === "all")
                form.setFieldValue(["packageAccess", field.name, "warehouseIds"], []);
            }}
            options={[
              { value: "selected", label: "Gudang terpilih" },
              { value: "all", label: "Seluruh gudang organisasi", disabled: !options.canGrantAll },
            ]}
          />
        </Form.Item>
      </Box>
      {scopeMode === "selected" ? (
        <Form.Item
          name={[field.name, "warehouseIds"]}
          label="Gudang yang dapat diakses"
          rules={[{ required: true, type: "array", min: 1, message: "Pilih minimal satu gudang." }]}
        >
          <Select
            mode="multiple"
            disabled={!options.inventoryEnabled || locked}
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
          Hanya Superadmin dapat mengubah paket ini karena cakupannya berada di luar kewenangan
          Anda.
        </FontStyle>
      ) : null}
      <Button
        disabled={locked}
        danger
        icon={<DeleteOutlined />}
        onClick={onRemove}
        style={{ justifySelf: "start" }}
      >
        Cabut paket
      </Button>
    </Box>
  );
}
export default function PackageAccessFields({ form, options, existing }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 2, my: 3, minWidth: 0 }}>
      <FontStyle component="h3" fontWeight={700}>
        Paket akses fitur
      </FontStyle>
      <FontStyle explanation fontSize={12} sx={{ color: "text.secondary" }}>
        Role dasar tetap berlaku. Paket hanya menambahkan akses Inventaris sesuai cakupan gudang.
      </FontStyle>
      {!options.inventoryEnabled ? (
        <FontStyle explanation fontSize={12}>
          Modul Inventaris belum aktif. Hubungi Superadmin untuk mengaktifkannya. Paket tersimpan
          tetap dipertahankan.
        </FontStyle>
      ) : null}
      <Form.List name="packageAccess">
        {(fields, { add, remove }) => (
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 2, minWidth: 0 }}>
            {fields.map((field) => (
              <PackageRow
                key={field.key}
                field={field}
                form={form}
                options={options}
                existing={existing}
                onRemove={() => remove(field.name)}
              />
            ))}
            {fields.length < 2 ? (
              <Button
                icon={<PlusOutlined />}
                disabled={!options.inventoryEnabled}
                onClick={() => add({ scopeMode: "selected", warehouseIds: [] })}
                style={{ justifySelf: "start" }}
              >
                Tambahkan paket
              </Button>
            ) : null}
          </Box>
        )}
      </Form.List>
    </Box>
  );
}
