"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Form, Input, InputNumber } from "antd";
import AppModal from "../modals/AppModal";
import ConfirmDialog from "../actions/ConfirmDialog";
import Notification from "../Notifications/Notification";
import useFormModalClose from "@/app/hooks/useFormModalClose";
import { useLoadingBackdrop } from "../loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError, applyApiFieldErrors } from "@/lib/api/clientError";
import { retirementPolicySchema } from "@/lib/retirement-policy/schema.mjs";

/** Satu sesi edit mempertahankan snapshot versi dan isian sampai penyimpanan berhasil. */
export default function RetirementPolicyEditor({ organization, policy, onClose, onSaved }) {
  const [form] = Form.useForm();
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const close = useFormModalClose(form, onClose);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Validasi bersama dijalankan sebelum konfirmasi tanpa membuang isian yang sudah benar. */
  function prepare(values) {
    const result = retirementPolicySchema.safeParse({ ...values, version: policy?.version || 0 });
    if (!result.success) {
      const fieldErrors = Object.fromEntries(
        result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      );
      applyApiFieldErrors(form, { fieldErrors });
      setError(result.error.issues[0].message);
      return;
    }
    if (policy?.retirement_age === result.data.retirementAge) {
      const message = "Usia pensiun belum berubah. Masukkan usia baru untuk menyimpan perubahan.";
      applyApiFieldErrors(form, { fieldErrors: { retirementAge: message } });
      setError(message);
      return;
    }
    setPending(result.data);
  }

  /** Snapshot yang dikonfirmasi dikirim tepat sekali; konflik server tetap membuka form. */
  async function save() {
    if (savingRef.current || !pending) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          await fetch(`/api/organization-settings/retirement?organizationId=${organization.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pending),
          }).then(readApiResponse);
        },
        { message: "Menyimpan kebijakan pensiun…" },
      );
      setDirty(false);
      onSaved();
    } catch (cause) {
      const failure = normalizeRequestError(cause);
      setPending(null);
      applyApiFieldErrors(form, failure);
      setError(failure.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <AppModal
        open
        title={policy ? "Ubah usia pensiun" : "Tetapkan usia pensiun"}
        description={organization.name}
        icon="solar:calendar-date-bold-duotone"
        size="sm"
        disableClose={saving || !!pending || close.confirmCloseOpen}
        onClose={close.requestClose}
        footer={
          <>
            <Button disabled={saving} onClick={close.requestClose}>
              Batal
            </Button>
            <Button type="primary" disabled={!dirty} loading={saving} onClick={() => form.submit()}>
              Simpan kebijakan
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ retirementAge: policy?.retirement_age ?? null, reason: "" }}
          onFinish={prepare}
          onValuesChange={(changed) => {
            setDirty(true);
            form.setFields(Object.keys(changed).map((name) => ({ name, errors: [] })));
          }}
          onFinishFailed={({ errorFields }) => {
            const first = errorFields[0];
            setError(first?.errors[0] || "Periksa usia pensiun dan alasan perubahan.");
            if (first) form.scrollToField(first.name, { focus: true });
          }}
        >
          <Form.Item
            name="retirementAge"
            label="Usia pensiun (tahun)"
            required
            extra={
              policy
                ? `Saat ini berlaku ${policy.retirement_age} tahun. Masukkan usia baru sesuai kebijakan organisasi.`
                : "Masukkan usia sesuai kebijakan organisasi, dalam tahun bulat."
            }
          >
            <InputNumber
              autoFocus
              min={18}
              max={100}
              style={{ width: "100%" }}
              placeholder="Contoh: 58"
            />
          </Form.Item>
          <Form.Item name="reason" label={policy ? "Alasan perubahan" : "Dasar kebijakan"} required>
            <Input.TextArea
              rows={3}
              maxLength={1000}
              showCount
              placeholder="Jelaskan dasar atau alasan penetapan usia pensiun"
            />
          </Form.Item>
          <Alert
            showIcon
            type="info"
            title="Berlaku untuk seluruh organisasi"
            description="Proyeksi pada dashboard, laporan, dan Excel mengikuti usia terbaru. Status pegawai tetap diproses oleh HRD."
            style={{ marginTop: 24 }}
          />
        </Form>
      </AppModal>
      <ConfirmDialog
        open={!!pending}
        title="Simpan kebijakan pensiun?"
        message={`Usia pensiun ${policy ? `berubah dari ${policy.retirement_age} menjadi` : "ditetapkan menjadi"} ${pending?.retirementAge || ""} tahun untuk ${organization.name}. Perubahan dan alasannya akan dicatat pada riwayat.`}
        confirmText="Simpan kebijakan"
        loading={saving}
        onConfirm={save}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={close.confirmCloseOpen}
        title="Tinggalkan perubahan?"
        message="Isian usia pensiun dan alasan belum disimpan. Tutup form dan buang perubahan?"
        confirmText="Buang perubahan"
        onConfirm={close.discardChanges}
        onClose={close.keepEditing}
      />
      <Notification open={!!error} severity="error" message={error} onClose={() => setError("")} />
    </>
  );
}
