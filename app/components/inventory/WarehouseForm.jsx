"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Select } from "antd";
import { Box } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";
export default function WarehouseForm({ open, item, organizationId, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const [locations, setLocations] = useState([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [pending, setPending] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const dirtyRef = useRef(false);
  const close = useFormModalClose(form, onClose, () => dirtyRef.current);
  const errorRef = useRef(onError);
  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    if (!open) return;
    dirtyRef.current = false;
    const controller = new AbortController();
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            code: item.code,
            name: item.name,
            locationId: item.location_id,
            notes: item.notes,
            isActive: item.is_active,
          }
        : { isActive: true },
    );
    void runWithLoadingBackdrop(
      async () => {
        setReady(false);
        const body = await readApiResponse(
          await fetch(`/api/inventory/warehouses?options=1&organizationId=${organizationId}`, {
            signal: controller.signal,
            cache: "no-store",
          }),
        );
        if (!controller.signal.aborted) {
          const options = body.data.map((value) => ({ value: value.id, label: value.name }));
          if (item && !options.some((o) => o.value === item.location_id))
            options.push({ value: item.location_id, label: item.location_name, disabled: true });
          setLocations(options);
          setReady(true);
        }
      },
      { message: "Memuat lokasi gudang..." },
    ).catch((error) => {
      if (error.name !== "AbortError") errorRef.current(error.message);
    });
    return () => controller.abort();
  }, [open, item, organizationId, form, runWithLoadingBackdrop]);
  const save = async (values) => {
    if (savingRef.current || !ready) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const body = await readApiResponse(
            await fetch(`/api/inventory/warehouses${item ? `/${item.id}` : ""}`, {
              method: item ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...values,
                notes: values.notes || null,
                organizationId: Number(organizationId),
                ...(item ? { version: item.version } : {}),
              }),
            }),
          );
          await onSaved(body.message);
        },
        { message: "Menyimpan gudang..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      onError(error.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      <AppModal
        open={open}
        title={item ? "Edit gudang" : "Tambah gudang"}
        description="Gudang menjadi tempat penyimpanan dan batas cakupan akses Inventaris."
        icon="inventory:warehouse"
        onClose={close.requestClose}
        disableClose={saving}
        footer={
          <>
            <Button disabled={saving} onClick={close.requestClose}>
              Batal
            </Button>
            <Button type="primary" disabled={!ready} loading={saving} onClick={() => form.submit()}>
              Simpan gudang
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            dirtyRef.current = true;
          }}
          onFinish={(values) => {
            if (item?.is_active && !values.isActive) setPending(values);
            else void save(values);
          }}
          onFinishFailed={({ errorFields }) => {
            onError("Periksa kembali isian gudang.");
            if (errorFields[0]) form.scrollToField(errorFields[0].name, { focus: true });
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
              gap: 2,
              minWidth: 0,
            }}
          >
            <Form.Item
              name="code"
              label="Kode gudang"
              rules={[
                { required: true, message: "Kode gudang wajib diisi." },
                {
                  pattern: /^[A-Za-z0-9_-]+$/,
                  message: "Gunakan huruf, angka, garis bawah atau tanda hubung.",
                },
              ]}
            >
              <Input maxLength={40} />
            </Form.Item>
            <Form.Item
              name="name"
              label="Nama gudang"
              rules={[{ required: true, whitespace: true, message: "Nama gudang wajib diisi." }]}
            >
              <Input maxLength={100} />
            </Form.Item>
          </Box>
          <Form.Item
            name="locationId"
            label="Lokasi operasional"
            rules={[{ required: true, message: "Lokasi wajib dipilih." }]}
            extra={
              item?.location_locked
                ? "Lokasi terkunci karena gudang telah digunakan dalam cakupan paket."
                : undefined
            }
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={locations}
              disabled={!ready || item?.location_locked}
            />
          </Form.Item>
          <Form.Item name="notes" label="Keterangan (opsional)">
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <FormSettingSwitch
            name="isActive"
            title="Gudang aktif"
            description="Gudang nonaktif tetap tercatat, tetapi tidak dapat dipilih untuk pemberian akses baru atau digunakan untuk transaksi stok nanti."
          />
        </Form>
      </AppModal>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Nonaktifkan gudang?"
        message="Gudang tidak dapat dipilih untuk akses baru atau transaksi stok. Cakupan paket dan riwayat tetap tersimpan."
        danger
        confirmText="Nonaktifkan"
        onClose={() => setPending(null)}
        onConfirm={() => {
          const values = pending;
          setPending(null);
          void save(values);
        }}
      />
      <ConfirmDialog
        open={close.confirmCloseOpen}
        title="Tutup tanpa menyimpan?"
        message="Perubahan gudang belum disimpan."
        confirmText="Tutup"
        onClose={close.keepEditing}
        onConfirm={close.discardChanges}
      />
    </>
  );
}
