"use client";
import { useMemo, useState } from "react";
import { Button, Form, Input } from "antd";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import AppModal from "@/app/components/modals/AppModal";
import FormSection from "@/app/components/forms/FormSection";
import ResponsiveRangePicker from "@/app/components/forms/ResponsiveRangePicker";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import SelectedEmployeesSummary from "@/app/components/employees/SelectedEmployeesSummary";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import DataPagination from "@/app/components/data-display/DataPagination";
import ScheduleSummary, { ScheduleSessionDetails } from "./ScheduleSummary";
import DailyAdjustmentReview from "./DailyAdjustmentReview";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { scheduleRequest, requestKey, applyFieldErrors } from "./ScheduleFields";
import useAdditionalScheduleUsage from "./useAdditionalScheduleUsage";
import ScheduleChoiceOption from "./ScheduleChoiceOption";
import {
  additionalUsageReason,
  replacementUsageReason,
  ALREADY_USED,
  shortUsageReason,
} from "@/lib/work-schedules/additionalUsage.mjs";

export default function BulkScheduleExceptionDialog({
  employees,
  organizationId,
  options,
  onClose,
  onSaved,
  onMessage,
}) {
  const [form] = Form.useForm();
  const [stage, setStage] = useState("form");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const mode = Form.useWatch("mode", form) || "replace";
  const scheduleId = Form.useWatch("scheduleId", form);
  const patternId = Form.useWatch("patternId", form);
  const schedule = options.adjustmentSchedules?.find((s) => s.id === scheduleId);
  const choice = schedule?.choices.find((c) => c.patternId === patternId);
  const hoursTitle = mode === "add" ? "Jam kerja tambahan" : "Jam kerja pengganti";
  const range = Form.useWatch("range", form);
  const from = range?.[0]?.format("YYYY-MM-DD"),
    until = range?.[1]?.format("YYYY-MM-DD");
  const validRange = Boolean(
    from &&
    until &&
    from >= options.today &&
    range[1].diff(range[0], "day") >= 0 &&
    range[1].diff(range[0], "day") <= 30,
  );
  const usage = useAdditionalScheduleUsage(
    validRange,
    JSON.stringify({
      organizationId: String(organizationId),
      employeeIds: employees.map((e) => e.id),
      from,
      until,
    }),
  );
  const reasons = useMemo(
    () =>
      new Map(
        (options.adjustmentSchedules || []).flatMap((schedule) =>
          schedule.choices.map((item) => [
            item.patternId,
            mode === "add"
              ? additionalUsageReason(item, usage.data, from, until)
              : replacementUsageReason(item, usage.data),
          ]),
        ),
      ),
    [mode, options.adjustmentSchedules, usage.data, from, until],
  );
  const reasonFor = (item) => reasons.get(item?.patternId) || "";
  const choiceReason = reasonFor(choice);
  const blockedSelection =
    !validRange || usage.loading || Boolean(usage.error) || Boolean(choiceReason);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState(null);
  const [receipt] = useState(requestKey);
  const [photoPreview, setPhotoPreview] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const displayRange = (input) =>
    `${dayjs(input.from).format("DD/MM/YYYY")}–${dayjs(input.until).format("DD/MM/YYYY")}`;
  const preview = async () => {
    if (blockedSelection) return;
    try {
      await form.validateFields();
    } catch (failure) {
      if (failure.errorFields?.[0])
        form.scrollToField(failure.errorFields[0].name, { focus: true });
      return;
    }
    const v = form.getFieldsValue(true);
    const input = {
      organizationId: String(organizationId),
      employeeIds: employees.map((e) => e.id),
      from: v.range[0].format("YYYY-MM-DD"),
      until: v.range[1].format("YYYY-MM-DD"),
      mode: v.mode,
      patternId: v.patternId,
    };
    setBusy(true);
    setError("");
    try {
      const response = await runWithLoadingBackdrop(
        () => scheduleRequest("/api/work-schedules/exceptions/bulk/preview", input),
        { message: "Memeriksa perubahan jam kerja..." },
      );
      setReview({ input: { ...input, reason: v.reason }, ...response.data });
      setPage(1);
      setStage("review");
    } catch (e) {
      setError(
        typeof e.code === "string"
          ? e.message
          : "Rincian perubahan belum dapat ditampilkan. Periksa koneksi, lalu coba lagi.",
      );
      applyFieldErrors(form, {
        ...e,
        fieldErrors: Object.fromEntries(
          Object.entries(e.fieldErrors || {}).map(([key, value]) => [
            key === "patternId" && schedule?.choices.length === 1 ? "scheduleId" : key,
            value,
          ]),
        ),
      });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!review || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await runWithLoadingBackdrop(
        () =>
          scheduleRequest("/api/work-schedules/exceptions/bulk", {
            ...review.input,
            previewHash: review.previewHash,
            requestKey: receipt,
          }),
        { message: "Menyimpan perubahan jam kerja..." },
      );
      onMessage(
        `Jadwal harian ${response.data.employeeCount} Pegawai untuk ${response.data.dayCount} hari berhasil disimpan.`,
      );
      onClose();
      await onSaved();
    } catch (e) {
      setError(
        typeof e.code === "string"
          ? e.message
          : "Status penyimpanan belum dapat dipastikan. Coba Simpan perubahan lagi tanpa mengubah isian untuk memeriksa hasil permintaan yang sama.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppModal
        keepMounted
        open={!photoPreview}
        title={stage === "review" ? "Tinjau perubahan jadwal" : "Ubah jadwal harian"}
        description={
          stage === "review"
            ? "Periksa tanggal, jam kerja, dan alasan sebelum menyimpan."
            : "Ganti atau tambahkan jam kerja pada tanggal yang Anda pilih. Jadwal utama pada tanggal lain tetap berlaku."
        }
        icon="solar:calendar-date-bold-duotone"
        onClose={onClose}
        disableClose={busy}
        contentResetKey={`${stage}:${page}`}
        pagination={
          stage === "review" && review && review.changes.length > 10 ? (
            <DataPagination
              pagination={{ page, pageSize, total: review.changes.length }}
              displayedCount={Math.min(pageSize, review.changes.length - (page - 1) * pageSize)}
              onPageChange={(next, size) => {
                setPage(next);
                setPageSize(size);
              }}
            />
          ) : undefined
        }
        footer={
          <>
            <Button disabled={busy} onClick={stage === "review" ? () => setStage("form") : onClose}>
              {stage === "review" ? "Kembali" : "Batal"}
            </Button>
            <Button
              type="primary"
              loading={busy}
              disabled={stage === "form" && blockedSelection}
              onClick={stage === "review" ? save : preview}
            >
              {stage === "review" ? "Simpan perubahan" : "Tinjau perubahan"}
            </Button>
          </>
        }
      >
        {error && (
          <AppNotice
            tone="danger"
            title="Perubahan belum selesai"
            description={error}
            sx={{ mb: 3 }}
          />
        )}
        <SelectedEmployeesSummary
          employees={employees}
          onPreview={setPhotoPreview}
          disabled={busy}
        />
        {stage === "review" && review && (
          <Box sx={{ display: "grid", gap: 3, mt: 3 }}>
            <AppNotice
              title={`${review.employeeCount} Pegawai · ${review.dayCount} hari`}
              description={`${review.changeCount} jadwal akan diubah pada ${displayRange(review.input)}.`}
            />
            {review.input.mode === "replace" && review.existingCount > 0 && (
              <AppNotice
                tone="warning"
                title="Perubahan jadwal sebelumnya akan diganti"
                description={`${review.existingCount} perubahan jadwal pada tanggal yang dipilih akan diganti. Jadwal utama pada tanggal lain tetap sama.`}
              />
            )}
            <Box>
              <FontStyle fontSize={14} fontWeight={600}>
                {review.input.mode === "add" ? "Tambah jam kerja" : "Ganti jam kerja"}
              </FontStyle>
              <FontStyle fontSize={14}>
                {schedule?.name}
                {choice?.label ? ` · ${choice.label}` : ""}
              </FontStyle>
            </Box>
            <DailyAdjustmentReview changes={review.changes} page={page} pageSize={pageSize} />
            <Box>
              <FontStyle fontSize={14} fontWeight={600}>
                Alasan perubahan
              </FontStyle>
              <FontStyle fontSize={14}>{review.input.reason}</FontStyle>
            </Box>
            <AppNotice
              title="Berlaku pada tanggal yang dipilih"
              description="Perubahan hanya berlaku untuk Pegawai dan tanggal yang dipilih, termasuk hari libur. Jadwal utama pada tanggal lain tetap sama."
            />
          </Box>
        )}
        <Box sx={{ display: stage === "form" ? "block" : "none", mt: 3 }}>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            disabled={busy}
            initialValues={{
              range: [dayjs(options.today), dayjs(options.today)],
              mode: "replace",
              reason: "",
            }}
            onValuesChange={() => {
              setReview(null);
              setError("");
            }}
          >
            <FormSection first title="Tanggal perubahan">
              <AppNotice
                description="Pilih maksimal 31 hari. Perubahan berlaku untuk semua Pegawai dan tanggal yang dipilih."
                descriptionAlign="left"
                sx={{ mb: 2 }}
              />
              <Form.Item
                name="range"
                label="Tanggal mulai dan selesai"
                style={{ marginBottom: 0 }}
                rules={[
                  {
                    validator: (_, value) =>
                      value?.length === 2 &&
                      value[0] &&
                      value[1] &&
                      value[0].format("YYYY-MM-DD") >= options.today &&
                      value[1].diff(value[0], "day") >= 0 &&
                      value[1].diff(value[0], "day") <= 30
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(
                              "Pilih tanggal mulai dan selesai yang sesuai, maksimal 31 hari dan tidak sebelum hari ini.",
                            ),
                          ),
                  },
                ]}
              >
                <ResponsiveRangePicker
                  formField
                  format="DD MMM YYYY"
                  allowClear={false}
                  disabledDate={(date, info) =>
                    date.format("YYYY-MM-DD") < options.today ||
                    Boolean(info?.from && Math.abs(date.diff(info.from, "day")) > 30)
                  }
                  style={{ width: "100%", maxWidth: 420 }}
                />
              </Form.Item>
            </FormSection>
            <FormSection title="Jenis perubahan">
              <Form.Item
                name="mode"
                style={{ marginBottom: 0 }}
                rules={[{ required: true, message: "Pilih jenis perubahan." }]}
              >
                <AsyncSelect
                  aria-label="Jenis perubahan"
                  placeholder="Pilih jenis perubahan"
                  onChange={() => {
                    form.setFields([
                      { name: "scheduleId", value: undefined, errors: [] },
                      { name: "patternId", value: undefined, errors: [] },
                    ]);
                  }}
                  options={[
                    { value: "replace", label: "Ganti jam kerja" },
                    { value: "add", label: "Tambah jam kerja" },
                  ]}
                />
              </Form.Item>
              <FontStyle fontSize={14} color="text.secondary" sx={{ mt: 1.5 }}>
                {mode === "add"
                  ? "Jam kerja yang berlaku tetap digunakan. Jam kerja yang Anda pilih akan ditambahkan."
                  : "Jam kerja yang berlaku akan diganti dengan jam kerja yang Anda pilih."}
              </FontStyle>
            </FormSection>
            <FormSection title={hoursTitle}>
              {usage.error && (
                <AppNotice
                  tone="danger"
                  title="Pilihan jadwal belum dapat diperiksa"
                  description={usage.error}
                  action={<Button onClick={usage.retry}>Coba lagi</Button>}
                  sx={{ mb: 2 }}
                />
              )}
              {choiceReason && (
                <AppNotice
                  tone="warning"
                  description={
                    choiceReason === ALREADY_USED
                      ? "Jadwal yang dipilih sudah digunakan. Pilih jadwal lain."
                      : `${choiceReason} Pilih jadwal lain.`
                  }
                  sx={{ mb: 2 }}
                />
              )}
              {options.error && (
                <AppNotice
                  tone="danger"
                  title="Pilihan jadwal belum dapat dimuat"
                  description={options.error}
                  action={<Button onClick={options.onRetry}>Coba lagi</Button>}
                  sx={{ mb: 2 }}
                />
              )}
              <Form.Item
                name="scheduleId"
                label="Jadwal kerja"
                rules={[{ required: true, message: "Pilih jadwal kerja." }]}
              >
                <AsyncSelect
                  placeholder="Pilih jadwal kerja"
                  optionRender={(option) => <ScheduleChoiceOption option={option} />}
                  loading={options.loading || usage.loading}
                  disabled={
                    busy ||
                    Boolean(options.error) ||
                    !validRange ||
                    usage.loading ||
                    Boolean(usage.error)
                  }
                  options={(options.adjustmentSchedules || []).map((s) => {
                    const blocked =
                      s.choices.length > 0 && s.choices.every((c) => Boolean(reasonFor(c)));
                    const allReasons = new Set(s.choices.map(reasonFor));
                    const reason = blocked
                      ? allReasons.size === 1
                        ? shortUsageReason(reasonFor(s.choices[0]))
                        : "Semua pilihan shift tidak dapat dipilih."
                      : "";
                    return {
                      value: s.id,
                      displayName: s.name,
                      label: s.name + (reason ? ` — ${reason}` : ""),
                      disabled: blocked,
                      disabledReason: reason,
                      title: reason || s.name,
                    };
                  })}
                  onSearch={options.onSearch}
                  notFoundContent={
                    options.loading ? "Memuat jadwal..." : "Belum ada jadwal kerja yang tersedia."
                  }
                  onChange={(id) => {
                    const selected = options.adjustmentSchedules.find((s) => s.id === id);
                    form.setFieldValue(
                      "patternId",
                      selected?.choices.length === 1 ? selected.choices[0].patternId : undefined,
                    );
                  }}
                />
              </Form.Item>
              <Form.Item
                name="patternId"
                label="Pilihan shift"
                hidden={
                  (schedule?.choices.length !== undefined && schedule.choices.length <= 1) ||
                  !schedule
                }
                rules={[{ required: true, message: "Pilih shift yang akan dijalani." }]}
              >
                <AsyncSelect
                  placeholder="Pilih shift"
                  optionRender={(option) => <ScheduleChoiceOption option={option} />}
                  disabled={busy || usage.loading || Boolean(usage.error)}
                  options={(schedule?.choices || []).map((c) => ({
                    value: c.patternId,
                    displayName: c.label || c.name,
                    label:
                      (c.label || c.name) +
                      (reasonFor(c) ? ` — ${shortUsageReason(reasonFor(c))}` : ""),
                    disabled: Boolean(reasonFor(c)),
                    disabledReason: shortUsageReason(reasonFor(c)),
                  }))}
                />
              </Form.Item>
              {choice?.days && <ScheduleSummary days={choice.days} />}
              {choice?.rules && <ScheduleSessionDetails rules={choice.rules} />}
              {mode === "add" && (
                <AppNotice
                  description="Jam kerja tambahan tidak otomatis menjadi lembur yang disetujui."
                  sx={{ mt: 2 }}
                />
              )}
            </FormSection>
            <FormSection title="Alasan perubahan" divider={false}>
              <Form.Item
                name="reason"
                label="Alasan"
                style={{ marginBottom: 0 }}
                rules={[
                  { required: true, whitespace: true, message: "Isi alasan perubahan." },
                  { min: 5, message: "Isi minimal 5 karakter." },
                ]}
              >
                <Input.TextArea
                  rows={3}
                  maxLength={1000}
                  showCount
                  placeholder="Tuliskan alasan perubahan jam kerja"
                />
              </Form.Item>
            </FormSection>
          </Form>
        </Box>
      </AppModal>
      <ImagePreviewModal
        open={Boolean(photoPreview)}
        {...photoPreview}
        onClose={() => setPhotoPreview(null)}
      />
    </>
  );
}
