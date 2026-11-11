"use client";
import AppCollapse from "@/app/components/data-display/AppCollapse";
import { useEffect, useState } from "react";
import { Form } from "antd";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import FormSettingSwitch, { FormSettingsGroup } from "@/app/components/forms/FormSettingSwitch";
import { TimeField, MinutesField } from "./ScheduleFields";
export default function WorkTimeFields({
  prefix,
  watchPrefix = prefix,
  readOnly,
  validationFocus,
}) {
  const form = Form.useFormInstance();
  const type = Form.useWatch([...watchPrefix, "type"], { form, preserve: true }) || "fixed";
  const [toleranceOpen, setToleranceOpen] = useState(false);
  const scope = watchPrefix.join(".");
  useEffect(() => {
    if (![`${scope}.lateTolerance`, `${scope}.earlyTolerance`].includes(validationFocus?.path))
      return;
    let active = true;
    queueMicrotask(() => {
      if (active) setToleranceOpen(true);
    });
    return () => {
      active = false;
    };
  }, [scope, validationFocus]);
  const path = (key) => [...prefix, key];
  if (type === "off" || type === "field")
    return (
      <FontStyle>{type === "off" ? "Libur" : "Aturan kerja lapangan dipertahankan."}</FontStyle>
    );
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
        columnGap: 2,
      }}
    >
      {type === "flexible" ? (
        <>
          <Box sx={{ gridColumn: "1 / -1", mb: 2 }}>
            <FontStyle explanation fontSize={12.5}>
              Tentukan rentang jam mulai, batas selesai, dan target kerja dalam menit. Target kerja
              harus muat sebelum batas selesai. Jika istirahat mengurangi durasi kerja, sediakan
              waktu untuk istirahat juga.
            </FontStyle>
          </Box>
          <TimeField
            name={path("windowStart")}
            label="Boleh masuk mulai"
            required
            disabled={readOnly}
          />
          <TimeField name={path("windowEnd")} label="Batas masuk" required disabled={readOnly} />
          <TimeField
            name={path("latestFinish")}
            label="Batas selesai"
            required
            disabled={readOnly}
          />
          <MinutesField name={path("requiredMinutes")} label="Target kerja" disabled={readOnly} />
        </>
      ) : type === "fixed" ? (
        <>
          <TimeField name={path("startTime")} label="Jam masuk" required disabled={readOnly} />
          <TimeField name={path("endTime")} label="Jam pulang" required disabled={readOnly} />
        </>
      ) : (
        <FontStyle>{type === "off" ? "Libur" : "Aturan kerja lapangan dipertahankan."}</FontStyle>
      )}
      <MinutesField name={path("breakMinutes")} label="Istirahat" disabled={readOnly} />
      <FormSettingsGroup sx={{ gridColumn: "1 / -1", mt: 1, mb: 3 }}>
        <FormSettingSwitch
          name={path("nextDay")}
          watchName={[...watchPrefix, "nextDay"]}
          title="Pulang hari berikutnya"
          disabled={readOnly}
          notice={{
            on: {
              title: "Pulang hari berikutnya",
              description: "Jam pulang jatuh pada hari berikutnya.",
            },
            off: {
              title: "Pulang pada hari yang sama",
              description:
                "Aktifkan jika jam pulang melewati tengah malam, misalnya masuk pukul 22.00 dan pulang pukul 06.00 besok.",
            },
          }}
        />
        <FormSettingSwitch
          name={path("deductBreak")}
          watchName={[...watchPrefix, "deductBreak"]}
          title="Kurangi waktu istirahat dari durasi kerja"
          disabled={readOnly}
          notice={{
            on: {
              title: "Waktu istirahat dikurangi dari durasi kerja",
              description:
                "Misalnya, jadwal 09.00–17.00 dengan istirahat 60 menit dihitung sebagai 7 jam kerja.",
            },
            off: {
              title: "Waktu istirahat termasuk dalam durasi kerja",
              description:
                "Misalnya, jadwal 09.00–17.00 dengan istirahat 60 menit dihitung sebagai 8 jam kerja.",
            },
          }}
        />
      </FormSettingsGroup>
      <Box sx={{ gridColumn: "1 / -1" }}>
        <AppCollapse
          activeKey={toleranceOpen ? ["tolerance"] : []}
          onChange={(keys) => setToleranceOpen(keys.includes("tolerance"))}
          items={[
            {
              key: "tolerance",
              label: "Toleransi waktu",
              forceRender: true,
              children: (
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  }}
                >
                  <Box sx={{ gridColumn: "1 / -1" }}>
                    <FontStyle explanation fontSize={12.5}>
                      Toleransi terlambat berlaku setelah jam masuk. Toleransi pulang awal berlaku
                      sebelum jam pulang. Nilai 0 berarti tidak ada toleransi.
                    </FontStyle>
                  </Box>
                  <MinutesField
                    name={path("lateTolerance")}
                    label="Toleransi terlambat"
                    disabled={readOnly}
                  />
                  <MinutesField
                    name={path("earlyTolerance")}
                    label="Toleransi pulang awal"
                    disabled={readOnly}
                  />
                </Box>
              ),
            },
          ]}
        />
      </Box>
    </Box>
  );
}
