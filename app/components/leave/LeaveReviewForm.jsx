"use client";
import { useState } from "react";
import { Button, Form, Input } from "antd";
import AppModal from "@/app/components/modals/AppModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import FileUploadListField from "@/app/components/forms/FileUploadListField";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse } from "@/lib/api/clientError";
const titles = {
  approve: "Setujui pengajuan",
  reject: "Tolak pengajuan",
  revise: "Minta perbaikan",
  documents: "Lengkapi dokumen",
};
export default function LeaveReviewForm({ item, action, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [submission, setSubmission] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  async function submit(values) {
    setBusy(true);
    try {
      const frozen = submission || {
        payload: {
          action,
          version: new Date(item.updated_at).toISOString(),
          requestKey: crypto.randomUUID(),
          ...(values.notes ? { notes: values.notes } : {}),
        },
        file: values.files?.[0]?.localFile,
      };
      setSubmission(frozen);
      await runWithLoadingBackdrop(async () => {
        const body = new FormData();
        body.append("payload", JSON.stringify(frozen.payload));
        if (frozen.file) body.append("file", frozen.file);
        await readApiResponse(
          await fetch(
            `/api/leave-requests/${item.id}/actions?organizationId=${item.organization_id}`,
            { method: "POST", body },
          ),
        );
        await onSaved("Pengajuan berhasil diperbarui.");
      });
    } catch (e) {
      if (e.status && e.status < 500) {
        setSubmission(null);
      }
      if (e.fieldErrors)
        form.setFields(
          Object.entries(e.fieldErrors).map(([name, error]) => ({ name, errors: [error] })),
        );
      onError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppModal
      open
      title={titles[action]}
      description={`${item.request_no} · ${item.full_name}`}
      icon="solar:calendar-search-bold-duotone"
      onClose={busy ? undefined : onClose}
      size="md"
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            Kembali
          </Button>
          <Button type="primary" disabled={busy} onClick={() => form.submit()}>
            {submission ? "Coba kirim lagi" : titles[action]}
          </Button>
        </>
      }
    >
      <AppNotice
        tone="info"
        title={item.leave_type_name}
        description={
          action === "approve"
            ? "Periksa periode, durasi dan dokumen sebelum menyetujui. Saldo akan digunakan setelah disetujui."
            : action === "revise"
              ? "Jelaskan isian atau dokumen yang perlu diperbaiki. Pegawai akan memperbaiki pengajuan yang sama."
              : action === "reject"
                ? "Penolakan ini merupakan keputusan akhir. Isi alasan yang jelas untuk Pegawai."
                : "Unggah dokumen lengkap milik Pegawai. Unggahan tidak otomatis menyetujui pengajuan."
        }
        style={{ marginBottom: 24 }}
      />
      <Form form={form} layout="vertical" onFinish={submit} disabled={busy || Boolean(submission)}>
        {action === "documents" ? (
          <Form.Item
            name="files"
            label="Dokumen pendukung"
            rules={[{ required: true, type: "array", min: 1, message: "Pilih dokumen." }]}
          >
            <FileUploadListField
              maxCount={1}
              maxSizeBytes={10 * 1024 * 1024}
              accept="application/pdf,.pdf"
              onError={onError}
            />
          </Form.Item>
        ) : (
          <Form.Item
            name="notes"
            label={action === "revise" ? "Catatan perbaikan" : "Catatan HRD"}
            rules={[
              { required: action !== "approve", min: 10, message: "Catatan minimal 10 karakter." },
            ]}
          >
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
        )}
      </Form>
    </AppModal>
  );
}
