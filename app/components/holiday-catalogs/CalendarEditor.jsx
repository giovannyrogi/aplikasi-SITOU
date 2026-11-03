"use client";
import { useEffect, useState } from "react";
import { Button, Form, Input, Space } from "antd";
import { Box } from "@mui/material";
import { ImportOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import FormSection from "@/app/components/forms/FormSection";
import IconActionButton from "@/app/components/actions/IconActionButton";
import EmptyState from "@/app/components/data-display/EmptyState";
import AppModal from "@/app/components/modals/AppModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import { InfoFieldGrid } from "@/app/components/employees/EmployeeDetailSections";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { DateField, scheduleRequest } from "@/app/components/work-schedules/ScheduleFields";
import CalendarCatalogPicker from "./CalendarCatalogPicker";
import { categoryLabel, displayDate } from "./HolidayDateList";
const emptyDays = [];
export default function CalendarEditor({
  open,
  item,
  form,
  organizationId,
  onClose,
  onSubmit,
  busy,
}) {
  const [stage, setStage] = useState("form"),
    [selection, setSelection] = useState(null);
  const [context, setContext] = useState({ today: null, error: "" }),
    [retry, setRetry] = useState(0);
  const days = Form.useWatch("days", { form, preserve: true }) || emptyDays;
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    if (open && stage === "form" && context.today) form.getFieldInstance("name")?.focus();
  }, [open, stage, form, context.today]);
  useEffect(() => {
    if (!open || !organizationId) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setStage("form");
        setContext({ today: null, error: "" });
      }
    });
    runWithLoadingBackdrop(
      () =>
        scheduleRequest(
          `/api/holiday-catalogs?organizationId=${organizationId}`,
          null,
          controller.signal,
        ),
      { message: "Memuat kalender..." },
    )
      .then((r) => {
        if (!controller.signal.aborted) setContext({ today: r.data.today, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setContext({ today: null, error: e.message });
      });
    return () => controller.abort();
  }, [open, organizationId, retry, runWithLoadingBackdrop]);
  const locked = (d) => Boolean(context.today && d?.date && d.date < context.today);
  const addSelection = () => {
    if (!selection || selection.overflow) return;
    form.setFieldsValue({
      days: [...days, ...selection.days].sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    });
    setSelection(null);
    setStage("form");
  };
  return (
    <AppModal
      open={open}
      onClose={onClose}
      disableClose={busy}
      size="lg"
      icon="navigation:work-calendars"
      title={
        stage === "catalog"
          ? "Tambahkan dari katalog"
          : item
            ? "Edit kalender libur"
            : "Buat kalender libur"
      }
      description={
        stage === "catalog" ? "Pilih tanggal dari katalog resmi." : "Atur hari libur organisasi."
      }
      contentResetKey={stage}
      footer={
        stage === "catalog" ? (
          <>
            <Button onClick={() => setStage("form")}>Kembali ke form</Button>
            <Button
              type="primary"
              disabled={!selection?.days.length || selection.overflow}
              onClick={addSelection}
            >
              Tambahkan ke form{selection?.days.length ? ` (${selection.days.length})` : ""}
            </Button>
          </>
        ) : (
          <Space>
            <Button onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button type="primary" loading={busy} disabled={!context.today} onClick={onSubmit}>
              Simpan kalender
            </Button>
          </Space>
        )
      }
    >
      {stage === "catalog" ? (
        <CalendarCatalogPicker organizationId={organizationId} days={days} onReady={setSelection} />
      ) : null}
      <Box sx={{ display: stage === "form" ? "block" : "none" }}>
        {context.error && (
          <AppNotice
            tone="danger"
            title="Kalender belum dapat dimuat"
            description={context.error}
            action={<Button onClick={() => setRetry((v) => v + 1)}>Coba lagi</Button>}
          />
        )}
        <Form form={form} layout="vertical" requiredMark={false} onFinish={onSubmit}>
          <FormSection first title="Identitas kalender">
            <Form.Item
              name="name"
              label="Nama kalender"
              style={{ marginBottom: 0 }}
              rules={[{ required: true, message: "Isi nama kalender." }]}
            >
              <Input maxLength={100} placeholder="Contoh: Kalender kantor pusat" />
            </Form.Item>
          </FormSection>
          <Form.List name="days">
            {(fields, { add, remove }) => {
              const official = fields.filter((f) => days[f.name]?.catalogDayId);
              const manual = fields.filter((f) => !days[f.name]?.catalogDayId);
              const renderDay = (f, index) => {
                const day = days[f.name] || {};
                const past = locked(day);
                const source = Boolean(day.catalogDayId);
                return (
                  <Box
                    key={f.key}
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                      minWidth: 0,
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                        {source ? (
                          <CompactInfoChip
                            label={categoryLabel(day.category)}
                            tone={day.category === "national" ? "success" : "info"}
                            sx={{ justifySelf: "start" }}
                          />
                        ) : (
                          <FontStyle fontWeight={600}>Hari libur {index + 1}</FontStyle>
                        )}
                        {source && (
                          <FontStyle color="text.secondary">
                            Katalog {day.catalogYear} · Revisi {day.catalogRevision}
                          </FontStyle>
                        )}
                        {past && (
                          <CompactInfoChip
                            label="Tanggal lampau terkunci"
                            tone="neutral"
                            sx={{ justifySelf: "start" }}
                          />
                        )}
                      </Box>
                      <IconActionButton
                        label={
                          past && item
                            ? "Tanggal lampau tidak dapat dihapus"
                            : "Hapus tanggal libur " + (day.name || index + 1)
                        }
                        icon={<DeleteOutlined />}
                        danger
                        disabled={(past && Boolean(item)) || !context.today || busy}
                        onClick={() => remove(f.name)}
                      />
                    </Box>
                    {source || past ? (
                      <InfoFieldGrid
                        items={[
                          ["Tanggal", displayDate(day.date)],
                          ["Nama hari libur", day.name],
                        ]}
                      />
                    ) : (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "minmax(0,1fr)",
                            sm: "minmax(0,1fr) minmax(0,2fr)",
                          },
                          gap: 2,
                          "& .ant-form-item": { mb: 0 },
                        }}
                      >
                        <DateField
                          name={[f.name, "date"]}
                          label="Tanggal"
                          required
                          disabled={!context.today || busy}
                          disabledDate={(date) =>
                            !context.today || date.format("YYYY-MM-DD") < context.today
                          }
                        />
                        <Form.Item
                          name={[f.name, "name"]}
                          label="Nama hari libur"
                          rules={[{ required: true, message: "Isi nama hari libur." }]}
                        >
                          <Input
                            maxLength={100}
                            disabled={!context.today || busy}
                            placeholder="Contoh: Hari jadi kantor"
                          />
                        </Form.Item>
                      </Box>
                    )}
                  </Box>
                );
              };
              return (
                <>
                  <FormSection
                    title="Libur dari katalog"
                    description="Pilih libur nasional dan cuti bersama yang berlaku."
                    action={
                      <IconActionButton
                        label="Tambahkan dari katalog"
                        icon={<ImportOutlined />}
                        disabled={!context.today || busy || fields.length >= 366}
                        onClick={() => setStage("catalog")}
                      />
                    }
                  >
                    {official.length ? (
                      <Box sx={{ display: "grid", gap: 2 }}>{official.map(renderDay)}</Box>
                    ) : (
                      <EmptyState
                        compact
                        description="Belum ada tanggal dari katalog. Pilih melalui tombol impor di atas."
                      />
                    )}
                  </FormSection>
                  <FormSection
                    title="Libur organisasi"
                    description="Atur tanggal libur tambahan khusus organisasi."
                    action={
                      <IconActionButton
                        label="Tambah libur organisasi"
                        icon={<PlusOutlined />}
                        disabled={!context.today || busy || fields.length >= 366}
                        onClick={() => {
                          const index = fields.length;
                          add({ date: null, name: "", catalogDayId: null });
                          requestAnimationFrame(() =>
                            form.getFieldInstance(["days", index, "date"])?.focus(),
                          );
                        }}
                      />
                    }
                  >
                    {manual.length ? (
                      <Box sx={{ display: "grid", gap: 2 }}>{manual.map(renderDay)}</Box>
                    ) : (
                      <EmptyState
                        compact
                        description="Belum ada libur organisasi. Gunakan tombol tambah untuk membuat tanggal."
                      />
                    )}
                  </FormSection>
                  {fields.length >= 366 && (
                    <FontStyle role="status" sx={{ mt: 2 }}>
                      Batas 366 tanggal telah tercapai. Hapus tanggal yang tidak diperlukan sebelum
                      menambahkan lagi.
                    </FontStyle>
                  )}
                </>
              );
            }}
          </Form.List>
          <FormSection title="Penggunaan kalender" divider={false}>
            <FormSettingSwitch
              name="isActive"
              title="Kalender aktif"
              description="Kalender aktif dapat dipilih pada jadwal kerja."
              disabled={busy}
            />
          </FormSection>
        </Form>
      </Box>
    </AppModal>
  );
}
