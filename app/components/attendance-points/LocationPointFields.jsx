"use client";
import { useEffect, useId, useState } from "react";
import { Button, Col, Form, InputNumber, Row, Tooltip } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Box } from "@mui/material";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import { readApiResponse } from "@/lib/api/clientError";

export default function LocationPointFields({ organizationId, locationId, manage, onReady }) {
  const form = Form.useFormInstance();
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ organizationId, configuration: "1" });
    if (locationId) params.set("locationId", locationId);
    fetch("/api/attendance-point-access?" + params, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(readApiResponse)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        form.setFields([
          { name: "attendanceEnabled", value: data?.enabled ?? false, touched: false },
          { name: "radiusMeters", value: data?.radiusMeters ?? null, touched: false },
          { name: "maxAccuracyMeters", value: data?.maxAccuracyMeters ?? null, touched: false },
        ]);
        setState({ loading: false });
        if (manage) onReady(true);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            loading: false,
            error:
              error.name === "TimeoutError"
                ? "Pemuatan pengaturan titik terlalu lama."
                : error.message,
          });
      });
    return () => {
      controller.abort();
      onReady(false);
    };
  }, [organizationId, locationId, form, manage, onReady]);
  if (state.loading) return <p role="status">Memuat pengaturan titik absen…</p>;
  if (state.error) return <p role="alert">{state.error}</p>;

  return (
    <FormSettingSwitch
      name="attendanceEnabled"
      fullWidthChildren
      title="Titik absen"
      disabled={!manage}
      notice={{
        on: {
          title: "Titik absen aktif",
          description: "Pegawai yang memiliki akses dapat absen di lokasi ini.",
        },
        off: {
          title: "Titik absen tidak aktif",
          description: "Pegawai tidak dapat absen di lokasi ini.",
        },
      }}
    >
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <PointNumberField
            name="radiusMeters"
            label="Radius absensi (meter)"
            help="Jarak terjauh dari titik absen yang masih diperbolehkan."
            requiredMessage="Isi radius absensi."
            min={5}
            manage={manage}
          />
        </Col>
        <Col xs={24} sm={12}>
          <PointNumberField
            name="maxAccuracyMeters"
            label="Batas akurasi GPS (meter)"
            help="Jika perkiraan meleset dari GPS melebihi batas ini, Pegawai perlu mengambil ulang lokasi."
            requiredMessage="Isi batas akurasi GPS."
            min={1}
            manage={manage}
          />
        </Col>
      </Row>
    </FormSettingSwitch>
  );
}

function PointNumberField({ name, label, help, requiredMessage, min, manage }) {
  const id = useId();
  return (
    <Form.Item label={label} htmlFor={id} required={manage} style={{ marginBottom: 12 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Form.Item
          name={name}
          noStyle
          rules={manage ? [{ required: true, message: requiredMessage }] : []}
        >
          <InputNumber
            id={id}
            disabled={!manage}
            min={min}
            max={50000}
            precision={0}
            style={{ flex: 1, minWidth: 0 }}
          />
        </Form.Item>
        <Tooltip title={help} trigger="click" placement="top">
          <Button
            htmlType="button"
            type="text"
            icon={
              <Box component="span" sx={{ color: "info.main", display: "inline-flex" }}>
                <ExclamationCircleOutlined />
              </Box>
            }
            aria-label={"Penjelasan " + label}
            style={{ flexShrink: 0, width: 44, height: 44 }}
          />
        </Tooltip>
      </Box>
    </Form.Item>
  );
}
