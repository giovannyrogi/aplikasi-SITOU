"use client";

import { useEffect, useState } from "react";
import { Alert, Button, DatePicker, Form, Input, Select } from "antd";
import { CalendarOutlined, UserDeleteOutlined } from "@ant-design/icons";
import { Box, useTheme } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { applyApiFieldErrors, readApiResponse } from "@/lib/api/clientError";
import {
  getEmployeeStatusPresentation,
  getTerminationStatusLabel,
  TERMINATION_STATUS_OPTIONS,
} from "./employeeStatus";
import { waitForMinimumDuration } from "@/lib/ui/minimumDuration.mjs";

/** Memformat tanggal kalender menjadi format Indonesia untuk ringkasan konfirmasi. */
function formatDate(value) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(dayjs(value).toDate());
}

/** Modal terkonfirmasi untuk mengakhiri lifecycle pegawai tanpa menghapus historinya. */
export default function EmployeeTerminationForm({
  open,
  employee,
  organizationId,
  onClose,
  onSaved,
  onError,
}) {
  const theme = useTheme();
  const [form] = Form.useForm();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [confirmValues, setConfirmValues] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !employee?.id) return;
    form.setFieldsValue({
      status: "terminated",
      terminationDate: dayjs(),
      reason: "",
    });
  }, [employee?.id, form, open]);

  if (!employee) return null;

  const currentStatus = getEmployeeStatusPresentation(employee.employment_status);

  /** Menutup seluruh lapisan konfirmasi dan mengembalikan kendali ke halaman pemanggil. */
  const requestClose = () => {
    if (submitting) return;
    setConfirmValues(null);
    onClose?.();
  };

  /** Mencegah tanggal sebelum bergabung maupun tanggal masa depan dipilih dari kalender. */
  const disableTerminationDate = (current) => {
    if (!current) return false;
    const joinedDate = dayjs(employee.joined_date).startOf("day");
    return (
      current.startOf("day").isBefore(joinedDate) ||
      current.startOf("day").isAfter(dayjs().endOf("day"))
    );
  };

  /** Menjalankan transaksi setelah pengguna menyetujui dampak akhir hubungan kerja. */
  const confirmTermination = async () => {
    if (!confirmValues) return;
    setSubmitting(true);
    const startedAt = Date.now();
    try {
      const result = await runWithLoadingBackdrop(
        async () => {
          try {
            const response = await fetch(`/api/employees/${employee.id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                organizationId,
                status: confirmValues.status,
                terminationDate: confirmValues.terminationDate.format("YYYY-MM-DD"),
                reason: confirmValues.reason.trim(),
                version: employee.updated_at,
              }),
            });
            return readApiResponse(response, "Hubungan kerja pegawai gagal diakhiri.");
          } finally {
            await waitForMinimumDuration(startedAt);
          }
        },
        { message: "Mengakhiri hubungan kerja pegawai..." },
      );
      setConfirmValues(null);
      onSaved?.(result.message || "Hubungan kerja pegawai berhasil diakhiri.", result.data);
    } catch (error) {
      applyApiFieldErrors(form, error, { nonFocusableFields: ["version"] });
      onError?.(error.message || "Hubungan kerja pegawai gagal diakhiri.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppModal
        open={open}
        title="Akhiri hubungan kerja"
        description="Catat status akhir dan tanggal efektif tanpa menghapus histori pegawai."
        icon="solar:user-block-rounded-bold-duotone"
        size="lg"
        disableClose={submitting}
        onClose={requestClose}
        footer={
          <>
            <Button onClick={requestClose} disabled={submitting}>
              Batal
            </Button>
            <Button
              type="primary"
              danger
              icon={<UserDeleteOutlined />}
              onClick={() => form.submit()}
              disabled={submitting}
            >
              Tinjau dan lanjutkan
            </Button>
          </>
        }
      >
        <Box sx={{ display: "grid", gap: 2.5 }}>
          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
              bgcolor: theme.ui.panelSubtleBg,
              border: `1px solid ${theme.ui.panelBorder}`,
              borderRadius: "8px",
            }}
          >
            <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}>
              <FontStyle fontSize={16} fontWeight={700}>
                {employee.full_name}
              </FontStyle>
              <FontStyle fontSize={12} sx={{ mt: 0.5, color: theme.ui.mutedText }}>
                NIP: {employee.employee_no}
              </FontStyle>
            </Box>
            <Box>
              <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                Status saat ini
              </FontStyle>
              <Box sx={{ mt: 0.75 }}>
                <CompactInfoChip label={currentStatus[0]} tone={currentStatus[1]} />
              </Box>
            </Box>
            <Box>
              <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                Penempatan aktif
              </FontStyle>
              <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.75 }}>
                {[employee.position_name, employee.unit_name, employee.location_name]
                  .filter(Boolean)
                  .join(" · ") || "Belum ditempatkan"}
              </FontStyle>
            </Box>
            <Box>
              <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                Kontrak aktif
              </FontStyle>
              <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.75 }}>
                {employee.contract_no || employee.employment_type_name || "Tidak ada kontrak aktif"}
              </FontStyle>
            </Box>
            <Box>
              <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
                Akun login
              </FontStyle>
              <FontStyle fontSize={12.5} fontWeight={600} sx={{ mt: 0.75 }}>
                {employee.user_id ? "Akan dinonaktifkan" : "Tidak tertaut akun"}
              </FontStyle>
            </Box>
          </Box>

          <Alert
            type="warning"
            showIcon
            title="Dampak pengakhiran"
            description="Penempatan dan kontrak aktif akan ditutup, akun login tertaut dinonaktifkan, dan seluruh histori tetap tersimpan."
          />

          <Form form={form} layout="vertical" onFinish={setConfirmValues} requiredMark>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
                gap: { xs: 0, md: 2 },
              }}
            >
              <Form.Item
                name="status"
                label="Jenis akhir hubungan kerja"
                rules={[{ required: true, message: "Pilih jenis akhir hubungan kerja." }]}
              >
                <Select options={TERMINATION_STATUS_OPTIONS} />
              </Form.Item>
              <Form.Item
                name="terminationDate"
                label="Tanggal efektif"
                rules={[
                  { required: true, message: "Pilih tanggal efektif pengakhiran." },
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (disableTerminationDate(value)) {
                        return Promise.reject(
                          new Error(
                            "Tanggal efektif harus sejak tanggal bergabung sampai hari ini.",
                          ),
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  disabledDate={disableTerminationDate}
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>
              <Form.Item
                name="reason"
                label="Alasan"
                style={{ gridColumn: "1 / -1" }}
                rules={[
                  { required: true, message: "Alasan pengakhiran wajib diisi." },
                  { min: 10, message: "Alasan wajib berisi minimal 10 karakter." },
                  { max: 2000, message: "Alasan maksimal 2.000 karakter." },
                ]}
              >
                <Input.TextArea
                  rows={5}
                  maxLength={2000}
                  showCount
                  placeholder="Jelaskan alasan pengakhiran secara jelas untuk kebutuhan histori dan audit."
                />
              </Form.Item>
            </Box>
          </Form>
        </Box>
      </AppModal>
      <ConfirmDialog
        open={Boolean(confirmValues)}
        title="Konfirmasi akhir hubungan kerja"
        message={
          confirmValues
            ? `${employee.full_name} akan berstatus ${getTerminationStatusLabel(confirmValues.status)} efektif ${formatDate(confirmValues.terminationDate)}. Penempatan, kontrak, dan akun tertaut akan dinonaktifkan.`
            : ""
        }
        confirmText="Akhiri hubungan kerja"
        danger
        loading={submitting}
        onConfirm={confirmTermination}
        onClose={() => !submitting && setConfirmValues(null)}
      />
    </>
  );
}
