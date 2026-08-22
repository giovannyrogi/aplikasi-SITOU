"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Col, Form, Input, Row, Switch } from "antd";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import AppModal from "@/app/components/modals/AppModal";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import OrganizationScopeField from "@/app/components/forms/OrganizationScopeField";
import OrganizationUnitTypeSelect from "@/app/components/selects/OrganizationUnitTypeSelect";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useFormModalClose from "@/app/hooks/useFormModalClose";

/** Form domain untuk membuat atau mengubah Divisi & Unit beserta cakupan lokasinya. */
export default function OrganizationUnitForm({
  open,
  item,
  presetOrganizationId,
  onClose,
  onSaved,
  onError,
}) {
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const closeGuard = useFormModalClose(form, onClose);
  const [options, setOptions] = useState({ loading: false, parents: [], locations: [] });
  const organizationId = Form.useWatch("organizationId", form);
  const previousOrganizationId = useRef(null);
  const editing = Boolean(item);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      item
        ? {
            organizationId: item.organization_id,
            parentUnitId: item.parent_unit_id || undefined,
            code: item.code,
            name: item.name,
            unitTypeId: item.unit_type_id,
            locationIds: (item.locations || []).map((location) => location.id),
            isActive: item.is_active,
          }
        : {
            organizationId: presetOrganizationId,
            locationIds: [],
            isActive: true,
          },
    );
  }, [form, item, open, presetOrganizationId]);

  useEffect(() => {
    if (!open) {
      previousOrganizationId.current = null;
      return;
    }
    if (
      previousOrganizationId.current &&
      String(previousOrganizationId.current) !== String(organizationId || "")
    )
      form.setFieldsValue({ unitTypeId: undefined, parentUnitId: undefined, locationIds: [] });
    previousOrganizationId.current = organizationId || null;
  }, [form, open, organizationId]);

  useEffect(() => {
    if (!open || !organizationId) return undefined;
    let active = true;

    Promise.resolve()
      .then(() => active && setOptions((current) => ({ ...current, loading: true })))
      .then(() =>
        Promise.all([
          fetch(`/api/organization-units/options?organizationId=${organizationId}`).then((r) =>
            r.json(),
          ),
          fetch(`/api/locations/options?organizationId=${organizationId}`).then((r) => r.json()),
        ]),
      )
      .then(([parentBody, locationBody]) => {
        if (!active) return;
        setOptions({
          loading: false,
          parents: (parentBody.data || [])
            .filter((option) => String(option.id) !== String(item?.id || ""))
            .map((option) => ({ value: option.id, label: `${option.code} - ${option.name}` })),
          locations: (locationBody.data || []).map((option) => ({
            value: option.id,
            label: `${option.code} - ${option.name}`,
          })),
        });
      })
      .catch(() => active && setOptions({ loading: false, parents: [], locations: [] }));
    return () => {
      active = false;
    };
  }, [item?.id, open, organizationId]);

  /** Mengirim payload bersih dan versi record saat melakukan edit. */
  const submit = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = {
            ...values,
            parentUnitId: values.parentUnitId || null,
            locationIds: values.locationIds || [],
            ...(editing ? { version: new Date(item.updated_at).toISOString() } : {}),
          };
          const response = await fetch(
            editing ? `/api/organization-units/${item.id}` : "/api/organization-units",
            {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          const body = await response.json();
          if (!response.ok) {
            if (body.fieldErrors)
              form.setFields(
                Object.entries(body.fieldErrors).map(([name, error]) => ({
                  name,
                  errors: [error],
                })),
              );
            throw new Error(body.message);
          }
          await onSaved(body.message);
        },
        { message: editing ? "Menyimpan divisi atau unit..." : "Membuat divisi atau unit..." },
      );
    } catch (error) {
      onError(error.message || "Divisi atau unit gagal disimpan.");
    }
  };

  return (
    <>
      <AppModal
        open={open}
        onClose={closeGuard.requestClose}
        title={editing ? "Edit divisi atau unit" : "Tambah divisi atau unit"}
        description="Susun hierarki unit dan tentukan lokasi tempat unit beroperasi."
        icon={<AccountTreeRoundedIcon sx={{ fontSize: 22 }} />}
        size="lg"
        footer={
          <>
            <Button onClick={closeGuard.requestClose}>Batal</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Simpan
            </Button>
          </>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <OrganizationScopeField disabled={editing} />
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="parentUnitId"
                label="Unit induk"
                extra="Pilih unit satu tingkat di atasnya untuk menyusun hierarki. Kosongkan jika unit ini berada di tingkat paling atas."
              >
                <AsyncSelect
                  allowClear
                  disabled={!organizationId}
                  loading={options.loading}
                  options={options.parents}
                  placeholder="Tanpa unit induk"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="code" label="Kode" rules={[{ required: true }]}>
                <Input placeholder="Contoh: DIV-SDM" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Nama divisi atau unit" rules={[{ required: true }]}>
                <Input placeholder="Contoh: Divisi Sumber Daya Manusia" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="unitTypeId"
                label="Jenis unit"
                rules={[{ required: true, message: "Jenis unit wajib dipilih." }]}
                extra="Jenis unit dikelola melalui menu Data Master > Jenis Unit Organisasi."
              >
                <OrganizationUnitTypeSelect
                  organizationId={organizationId}
                  includeId={item?.unit_type_id}
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                name="locationIds"
                label="Lokasi operasional"
                extra="Boleh dikosongkan bila unit belum ditempatkan pada lokasi tertentu."
              >
                <AsyncSelect
                  mode="multiple"
                  allowClear
                  disabled={!organizationId}
                  loading={options.loading}
                  options={options.locations}
                  placeholder="Pilih satu atau beberapa lokasi"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="isActive" label="Status aktif" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </AppModal>
      <ConfirmDialog
        open={closeGuard.confirmCloseOpen}
        title="Buang perubahan?"
        message="Perubahan pada formulir divisi atau unit belum disimpan."
        confirmText="Buang perubahan"
        danger
        onClose={closeGuard.keepEditing}
        onConfirm={closeGuard.discardChanges}
      />
    </>
  );
}
