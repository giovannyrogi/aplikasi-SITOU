"use client";
import { useState } from "react";
import { Button, Form } from "antd";
import { Box } from "@mui/material";
import PageHeader from "@/app/components/layout/PageHeader";
import DataPanel from "@/app/components/data-display/DataPanel";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import OrganizationSelect from "@/app/components/selects/OrganizationSelect";
import FontStyle from "@/app/components/font-style/FontStyle";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import Notification from "@/app/components/Notifications/Notification";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import useAppNotification from "@/app/hooks/useAppNotification";
import useDataList from "@/app/hooks/useDataList";
import { hrisLevel } from "@/lib/access/hrisPolicy.mjs";
import TemplateEditor from "./TemplateEditor";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import { templateValues, templateReview, shiftGroupPayload } from "./scheduleForm.mjs";
import ScheduleReview from "./ScheduleReview";
import {
  templateSchema,
  shiftGroupSchema,
  scheduleValidationMessage,
} from "@/lib/work-schedules/schemas.mjs";
import ShiftGroupSummary from "./ShiftGroupSummary";
import ScheduleSummary from "./ScheduleSummary";
import AppModal from "@/app/components/modals/AppModal";
import { applyFieldErrors, requestKey, scheduleRequest } from "./ScheduleFields";

export default function TemplatePage() {
  const user = useAuthenticatedUser();
  const platform = user.role_code === "superadmin";
  const manage = hrisLevel(user, "work-shifts") === "manage";
  const [activeType, setActiveType] = useState("fixed");
  const list = useDataList(
    activeType === "shift" ? "/api/work-schedule-groups" : "/api/work-schedule-templates",
    {
      requiredFilter: "organizationId",
      initialFilters: platform
        ? { standalone: "true" }
        : { organizationId: String(user.organization_id), standalone: "true" },
    },
  );
  const changeType = (type) => {
    setActiveType(type);
    list.updateFilters({ ...list.filters, standalone: type === "fixed" ? "true" : undefined });
  };
  const org = list.filters.organizationId;
  const [form] = Form.useForm();
  const [editor, setEditor] = useState(null);
  const [view, setView] = useState(null);
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [validationFocus, setValidationFocus] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  const open = (item = null, copy = false) => {
    setValidationFocus(null);
    setReview(null);
    form.resetFields();
    form.setFieldsValue(templateValues(item, copy));
    setEditor({ item: copy ? null : item, source: item, key: requestKey() });
  };
  const reportErrors = (error) => {
    let focusDay;
    const dayError = Object.keys(error.fieldErrors || {}).find((key) => /^days\.\d+\./.test(key));
    if (dayError) {
      const index = Number(dayError.split(".")[1]);
      const day = form.getFieldValue("days")?.[index]?.day;
      if (
        form.getFieldValue("patternType") === "rotation" ||
        (form.getFieldValue("customDays") || []).includes(day)
      )
        focusDay = day;
    }
    if (form.getFieldValue("patternType") === "weekly") {
      const customDays = form.getFieldValue("customDays") || [];
      error.fieldErrors = Object.fromEntries(
        Object.entries(error.fieldErrors || {}).map(([key, message]) => {
          const match = key.match(/^days\.(\d+)\.sessions\.\d+\.rules\./);
          const path =
            match && !customDays.includes(Number(match[1]) + 1)
              ? key.replace(/^days\.\d+\.sessions\.\d+\.rules\./, "sharedRules.")
              : key;
          return [
            path.replace(/^rules\./, "sharedRules.").replace(/^days$/, "workingDays"),
            message,
          ];
        }),
      );
    }
    setValidationFocus({
      day: focusDay,
      path: Object.keys(error.fieldErrors || {})[0],
      request: requestKey(),
    });
    applyFieldErrors(form, error);
    showNotification(error.message, "error");
  };
  const prepareReview = async (calendarName) => {
    if (busy) return;
    try {
      await form.validateFields();
      const values = form.getFieldsValue(true);
      const shiftMode = values.workType === "shift";
      const next = shiftMode
        ? { payload: shiftGroupPayload(values), workType: "shift" }
        : templateReview(values, editor.source);
      const parsed = (shiftMode ? shiftGroupSchema : templateSchema).safeParse(
        {
          ...next.payload,
          organizationId: org,
          requestKey: editor.key,
          ...(editor.item ? { id: editor.item.id, version: editor.item.version } : {}),
        },
        { error: scheduleValidationMessage },
      );
      if (!parsed.success) {
        const error = new Error(parsed.error.issues[0].message);
        error.fieldErrors = Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
        );
        reportErrors(error);
        return;
      }
      setReview({
        ...next,
        payload: parsed.data,
        calendarName:
          calendarName ||
          (next.payload.calendarId === editor.source?.calendar_id
            ? editor.source.calendar_name
            : null),
      });
    } catch (error) {
      if (error.errorFields) {
        reportErrors({
          message: error.errorFields[0]?.errors?.[0] || "Periksa isian jadwal.",
          fieldErrors: Object.fromEntries(
            error.errorFields.map((field) => [field.name.join("."), field.errors[0]]),
          ),
        });
      } else reportErrors(error);
    }
  };
  const save = async () => {
    if (busy || !review) return;
    setBusy(true);
    try {
      await runWithLoadingBackdrop(
        () =>
          scheduleRequest(
            review.workType === "shift"
              ? "/api/work-schedule-groups"
              : "/api/work-schedule-templates",
            {
              ...review.payload,
            },
          ),
        { message: "Menyimpan jadwal..." },
      );
      setEditor(null);
      setReview(null);
      const savedType = review.workType === "shift" ? "shift" : "fixed";
      if (savedType === activeType) await list.refresh();
      else changeType(savedType);
      showNotification("Jadwal kerja disimpan.");
    } catch (error) {
      setReview(null);
      reportErrors(error);
    } finally {
      setBusy(false);
    }
  };
  const actions = (item) => [
    { key: "view", label: "Lihat jadwal", onClick: () => setView(item) },
    ...(manage
      ? [
          { key: "edit", label: "Edit jadwal", onClick: () => open(item) },
          { key: "copy", label: "Buat salinan jadwal", onClick: () => open(item, true) },
        ]
      : []),
  ];
  const description = (x) =>
    x.kind === "shift"
      ? `${x.shifts.length} pilihan shift`
      : x.pattern_type === "weekly"
        ? "Setiap minggu"
        : "Pengaturan lama";
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Jadwal Kerja"
        description="Atur hari kerja, jam masuk, jam pulang, dan libur dalam satu form."
        action={
          manage && (
            <Button type="primary" disabled={!org} onClick={() => open()}>
              Buat jadwal kerja
            </Button>
          )
        }
      />
      <OperationalFilterSection
        description="Cari jadwal berdasarkan nama, status, dan jenis jam kerja."
        onReset={() => {
          list.setSearch("");
          list.setStatus("all");
          changeType("fixed");
        }}
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Cari nama jadwal"
        status={list.status}
        onStatusChange={list.setStatus}
        onRefresh={list.refresh}
        items={[
          ...(platform
            ? [
                {
                  key: "org",
                  label: "Organisasi",
                  control: (
                    <OrganizationSelect
                      value={org}
                      onChange={(organizationId) => {
                        setEditor(null);
                        setReview(null);
                        form.resetFields();
                        list.updateFilters({ ...list.filters, organizationId });
                      }}
                    />
                  ),
                },
              ]
            : []),
          {
            key: "workType",
            label: "Jenis jam kerja",
            control: (
              <AsyncSelect
                aria-label="Jenis jam kerja"
                value={activeType}
                onChange={changeType}
                options={[
                  { value: "fixed", label: "Jam kerja tetap" },
                  { value: "shift", label: "Kerja shift" },
                ]}
              />
            ),
          },
        ]}
      />
      <DataPanel title="Pilihan jadwal kerja">
        <ResponsiveDataView
          data={list.data}
          loading={list.loading}
          error={list.error}
          onRetry={list.refresh}
          pagination={list.pagination}
          onPageChange={list.setPage}
          emptyDescription={org ? "Belum ada jadwal kerja." : "Pilih organisasi."}
          columns={[
            { title: "Nama jadwal", dataIndex: "name" },
            { title: "Susunan hari", render: (_, x) => description(x) },
            { title: "Status", render: (_, x) => (x.is_active ? "Aktif" : "Nonaktif") },
            { title: "Aksi", render: (_, x) => <RowActionMenu items={actions(x)} /> },
          ]}
          renderCard={(x) => (
            <Box sx={{ display: "grid", gap: 2 }}>
              <FontStyle fontWeight={600}>{x.name}</FontStyle>
              <FontStyle>
                {description(x)} · {x.is_active ? "Aktif" : "Nonaktif"}
              </FontStyle>
              {x.kind === "shift" ? (
                <ShiftGroupSummary
                  shifts={x.shifts}
                  workingDays={x.working_days}
                  calendarName={x.calendar_name}
                  holidayPolicy={x.holiday_policy}
                />
              ) : (
                <ScheduleSummary
                  days={x.days.slice(0, 7)}
                  patternType={x.pattern_type}
                  calendarName={x.calendar_name}
                  holidayPolicy={x.holiday_policy}
                />
              )}
              <RowActionMenu items={actions(x)} />
            </Box>
          )}
        />
      </DataPanel>
      {editor && (
        <TemplateEditor
          key={editor.key}
          open={!review}
          form={form}
          item={editor.item}
          source={editor.source}
          organizationId={org}
          busy={busy}
          onClose={() => setEditor(null)}
          onSubmit={prepareReview}
          validationFocus={validationFocus}
        />
      )}
      {review && (
        <ScheduleReview
          review={review}
          calendarName={review.calendarName}
          busy={busy}
          onBack={() => setReview(null)}
          onSave={save}
        />
      )}
      <AppModal
        scrollHeaderWithContent
        open={Boolean(view)}
        title={view?.name || "Jadwal kerja"}
        description="Lihat hari kerja, jam, istirahat, toleransi, dan ketentuan libur pada jadwal ini."
        onClose={() => setView(null)}
        footer={<Button onClick={() => setView(null)}>Tutup</Button>}
      >
        {view?.kind === "shift" ? (
          <ShiftGroupSummary
            shifts={view.shifts}
            workingDays={view.working_days}
            calendarName={view.calendar_name}
            holidayPolicy={view.holiday_policy}
            showSettings
          />
        ) : (
          <ScheduleSummary
            days={view?.days || []}
            patternType={view?.pattern_type}
            calendarName={view?.calendar_name}
            holidayPolicy={view?.holiday_policy}
            showSettings
          />
        )}
      </AppModal>
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
