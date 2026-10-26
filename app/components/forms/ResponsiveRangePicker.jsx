"use client";

import { cloneElement, forwardRef, useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Button, Calendar, DatePicker, Form } from "antd";
import dayjs from "dayjs";
import { CloseCircleOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { alpha } from "@mui/material/styles";
import AppModal from "@/app/components/modals/AppModal";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Desktop memakai RangePicker; mobile mengonfirmasi rentang lewat satu kalender. */
const RangePickerControl = forwardRef(function RangePickerControl(props, ref) {
  const {
    value,
    onChange,
    format = "DD MMM YYYY",
    allowClear = true,
    disabled,
    presets = [],
    disabledDate,
    minDate,
    maxDate,
    placeholder = ["Tanggal mulai", "Tanggal akhir"],
    style,
    status,
    id,
    onBlur,
    onFocus,
  } = props;
  const mobile = useMediaQuery("(max-width: 767px)");
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([null, null]);
  const [active, setActive] = useState(0);
  const [month, setMonth] = useState(dayjs);
  const text = (date) =>
    date?.isValid() ? date.format(typeof format === "string" ? format : "DD MMM YYYY") : "";
  const blocked = (date) =>
    (minDate && date.isBefore(minDate, "day")) ||
    (maxDate && date.isAfter(maxDate, "day")) ||
    disabledDate?.(date, { type: "date", from: active === 1 ? draft[0] : undefined });
  const complete =
    draft[0] &&
    draft[1] &&
    !draft[1].isBefore(draft[0], "day") &&
    !blocked(draft[0]) &&
    !blocked(draft[1]);
  const close = () => setOpen(false);
  const commit = (dates) => {
    onChange?.(dates, dates ? dates.map(text) : ["", ""]);
    close();
  };
  const begin = () => {
    setDraft(value ? [...value] : [null, null]);
    setActive(0);
    setMonth(value?.[0] || dayjs());
    setOpen(true);
  };
  const choose = (date) => {
    if (blocked(date)) return;
    if (active === 0) {
      setDraft([date, null]);
      setActive(1);
    } else {
      setDraft(date.isBefore(draft[0], "day") ? [date, draft[0]] : [draft[0], date]);
      setActive(0);
    }
    setMonth(date);
  };
  if (!mobile) return <DatePicker.RangePicker {...props} ref={ref} />;
  const selectStyle = {
    minWidth: 0,
    flex: 1,
    height: 44,
    border: 0,
    borderRadius: 8,
    background: theme.palette.background.paper,
    color: theme.palette.text.primary,
    font: "inherit",
    fontSize: 16,
    fontWeight: 600,
    textAlign: "center",
  };
  const isDisabled = Array.isArray(disabled) ? disabled.some(Boolean) : disabled;
  return (
    <>
      <Box sx={{ position: "relative", minWidth: 0 }}>
        <Button
          ref={ref}
          id={id}
          disabled={isDisabled}
          onClick={begin}
          onBlur={onBlur}
          onFocus={onFocus}
          aria-label={props["aria-label"] || "Pilih rentang tanggal"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={status === "error" || undefined}
          aria-describedby={props["aria-describedby"]}
          style={{
            width: "100%",
            minHeight: 44,
            height: "auto",
            padding: allowClear && value?.[0] ? "10px 48px 10px 12px" : "10px 12px",
            textAlign: "left",
            borderColor: status === "error" ? theme.palette.error.main : undefined,
            ...style,
          }}
        >
          <Box
            component="span"
            sx={{ display: "flex", width: "100%", alignItems: "center", gap: 1, minWidth: 0 }}
          >
            <Box
              component="span"
              sx={{
                flex: 1,
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                color: value?.[0] ? "text.primary" : "text.secondary",
              }}
            >
              {value?.[0]
                ? `${text(value[0])} – ${text(value[1])}`
                : `${placeholder[0]} – ${placeholder[1]}`}
            </Box>
            {!(allowClear && value?.[0]) ? (
              <AppIcon icon="solar:calendar-date-bold-duotone" width={18} />
            ) : null}
          </Box>
        </Button>
        {allowClear && value?.[0] ? (
          <Button
            type="text"
            aria-label="Kosongkan rentang tanggal"
            disabled={isDisabled}
            icon={<CloseCircleOutlined />}
            onClick={() => commit(null)}
            style={{
              position: "absolute",
              right: 2,
              top: "50%",
              transform: "translateY(-50%)",
              width: 44,
              height: 44,
              color: theme.palette.text.secondary,
            }}
          />
        ) : null}
      </Box>
      <AppModal
        open={open}
        onClose={close}
        title="Rentang tanggal"
        icon={null}
        size="sm"
        contentSx={{ p: 1.5 }}
        footer={
          <Button
            type="primary"
            block
            disabled={!complete}
            onClick={() => commit(draft)}
            style={{ minHeight: 44 }}
          >
            Terapkan
          </Button>
        }
      >
        <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
          <FontStyle
            role="status"
            aria-live="polite"
            fontSize={14}
            fontWeight={600}
            sx={{ textAlign: "center", py: 0.5, color: "text.primary" }}
          >
            {draft[0] ? text(draft[0]) : "Tanggal mulai"}{" "}
            <Box component="span" sx={{ px: 1, color: "text.secondary", fontWeight: 400 }}>
              –
            </Box>{" "}
            {draft[1] ? text(draft[1]) : "Tanggal akhir"}
          </FontStyle>
          <Box
            component="span"
            sx={{
              position: "absolute",
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: "hidden",
              clip: "rect(0,0,0,0)",
              whiteSpace: "nowrap",
            }}
            aria-live="polite"
          >
            {active === 0 ? "Pilih tanggal mulai untuk rentang baru" : "Pilih tanggal akhir"}
          </Box>
          {presets.length ? (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: 1,
              }}
            >
              {presets.map((preset, index) => (
                <Button
                  key={index}
                  style={{ minHeight: 44 }}
                  onClick={() => {
                    const dates =
                      typeof preset.value === "function" ? preset.value() : preset.value;
                    if (dates?.length === 2 && dates.every((date) => !blocked(date))) {
                      setDraft(dates);
                      setMonth(dates[0]);
                      setActive(0);
                    }
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </Box>
          ) : null}
          <Box
            sx={{
              minWidth: 0,
              "& .ant-picker-calendar": { width: "100%" },
              "& .ant-picker-content": { width: "100%", tableLayout: "fixed" },
              "& .ant-picker-cell": { padding: "2px 0" },
              "& .ant-picker-cell-inner": {
                width: "100% !important",
                height: "44px !important",
                lineHeight: "44px !important",
              },
            }}
          >
            <Calendar
              fullscreen={false}
              mode="month"
              value={month}
              disabledDate={blocked}
              onSelect={(date, info) => {
                if (info.source === "date") choose(date);
              }}
              headerRender={() => (
                <Box sx={{ display: "flex", gap: 0.5, mb: 1, alignItems: "center", minWidth: 0 }}>
                  <Button
                    type="text"
                    aria-label="Bulan sebelumnya"
                    onClick={() => setMonth(month.subtract(1, "month"))}
                    style={{ minWidth: 44, minHeight: 44 }}
                    icon={<LeftOutlined />}
                  />
                  <select
                    aria-label="Bulan kalender"
                    value={month.month()}
                    style={selectStyle}
                    onChange={(event) => setMonth(month.month(Number(event.target.value)))}
                  >
                    {Array.from({ length: 12 }, (_, index) => (
                      <option key={index} value={index}>
                        {month.month(index).format("MMMM")}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Tahun kalender"
                    value={month.year()}
                    style={selectStyle}
                    onChange={(event) => setMonth(month.year(Number(event.target.value)))}
                  >
                    {Array.from({ length: 201 }, (_, index) => month.year() - 100 + index).map(
                      (year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ),
                    )}
                  </select>
                  <Button
                    type="text"
                    aria-label="Bulan berikutnya"
                    onClick={() => setMonth(month.add(1, "month"))}
                    style={{ minWidth: 44, minHeight: 44 }}
                    icon={<RightOutlined />}
                  />
                </Box>
              )}
              fullCellRender={(date, info) => {
                if (info.type !== "date") return info.originNode;
                const endpoint = draft.some((entry) => entry?.isSame(date, "day"));
                const between =
                  draft[0] &&
                  draft[1] &&
                  date.isAfter(draft[0], "day") &&
                  date.isBefore(draft[1], "day");
                return cloneElement(info.originNode, {
                  style: {
                    ...info.originNode.props.style,
                    ...(endpoint
                      ? {
                          background: theme.palette.primary.main,
                          color: theme.palette.primary.contrastText,
                          borderRadius: 6,
                        }
                      : between
                        ? { background: alpha(theme.palette.primary.main, 0.08), borderRadius: 0 }
                        : {}),
                  },
                });
              }}
            />
          </Box>
        </Box>
      </AppModal>
    </>
  );
});

const FormRangePicker = forwardRef(function FormRangePicker(props, ref) {
  const { status } = Form.Item.useStatus();
  return <RangePickerControl {...props} status={props.status || status} ref={ref} />;
});

export default forwardRef(function ResponsiveRangePicker({ formField = false, ...props }, ref) {
  return formField ? (
    <FormRangePicker {...props} ref={ref} />
  ) : (
    <RangePickerControl {...props} ref={ref} />
  );
});
