"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, Space, Table } from "antd";
import dayjs from "dayjs";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import AppModal from "@/app/components/modals/AppModal";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import ModernTableFrame from "@/app/components/data-display/ModernTableFrame";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

/** Memformat batas periode langganan untuk tampilan histori. */
const fmt = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "—";
export default function SubscriptionModal({ open, organization, onClose, onChanged, onError }) {
  const theme = useTheme();
  const [form] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState(null);
  const mobile = useMediaQuery("(max-width:767px)");
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch("/api/organizations/" + organization.id + "/subscriptions");
          const body = await readApiResponse(response);
          setItems(body.data || []);
        },
        { message: "Memuat histori langganan..." },
      );
    } catch (error) {
      onError(error.message);
    } finally {
      setLoading(false);
    }
  }, [onError, organization, runWithLoadingBackdrop]);
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      startsOn: dayjs().add(1, "day"),
      endsOn: dayjs().add(1, "year"),
      graceEndsOn: null,
    });
    Promise.resolve().then(load);
  }, [form, load, open]);
  const create = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const requestId = crypto.randomUUID();
          const response = await fetch(`/api/organizations/${organization.id}/subscriptions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
            body: JSON.stringify({
              startsOn: values.startsOn.format("YYYY-MM-DD"),
              endsOn: values.endsOn.format("YYYY-MM-DD"),
              graceEndsOn: values.graceEndsOn?.format("YYYY-MM-DD") || null,
              notes: values.notes || null,
            }),
          });
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
          form.resetFields();
          await load();
          await onChanged(body.message);
        },
        { message: "Menambahkan periode langganan..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };
  const changeStatus = async (values) => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(
            `/api/organizations/${organization.id}/subscriptions/${action.item.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json", "X-Request-ID": crypto.randomUUID() },
              body: JSON.stringify({
                action: action.type,
                reason: values.reason,
                version: new Date(action.item.updated_at).toISOString(),
              }),
            },
          );
          const body = await readApiResponse(response);
          setAction(null);
          actionForm.resetFields();
          await load();
          await onChanged(body.message);
        },
        { message: "Memperbarui status langganan..." },
      );
    } catch (error) {
      onError(error.message);
    }
  };
  const actions = (item) => (
    <Space wrap>
      {!["suspended", "cancelled"].includes(item.status) && (
        <Button size="small" onClick={() => setAction({ type: "suspend", item })}>
          Tangguhkan
        </Button>
      )}
      {item.status !== "cancelled" && (
        <Button size="small" danger onClick={() => setAction({ type: "cancel", item })}>
          Batalkan
        </Button>
      )}
      {["suspended", "cancelled"].includes(item.status) && (
        <Button size="small" type="primary" onClick={() => setAction({ type: "restore", item })}>
          Pulihkan
        </Button>
      )}
    </Space>
  );
  const columns = [
    { title: "Periode", render: (_, item) => `${fmt(item.starts_on)} – ${fmt(item.ends_on)}` },
    { title: "Tenggang", dataIndex: "grace_ends_on", render: fmt },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => <CompactInfoChip status={status} />,
    },
    { title: "Dibuat oleh", dataIndex: "created_by_name", render: (v) => v || "Migration" },
    { title: "Aksi", render: (_, item) => actions(item) },
  ];
  return (
    <>
      <AppModal
        open={open}
        onClose={onClose}
        title={`Langganan ${organization?.name || ""}`}
        description="Perpanjangan selalu membuat periode baru dan mempertahankan histori."
        icon="solar:calendar-mark-bold-duotone"
        size="xl"
        footer={<Button onClick={onClose}>Tutup</Button>}
      >
        <Form form={form} layout="vertical" onFinish={create}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3,1fr)" },
              gap: 2,
            }}
          >
            <Form.Item name="startsOn" label="Mulai akses" rules={[{ required: true }]}>
              <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="endsOn" label="Akhir akses" rules={[{ required: true }]}>
              <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item name="graceEndsOn" label="Akhir tenggang">
              <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
            </Form.Item>
          </Box>
          <Form.Item name="notes" label="Catatan">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Tambah periode
          </Button>
        </Form>
        <Box sx={{ mt: 3 }}>
          <FontStyle fontSize={15} fontWeight={600} sx={{ mb: 1.5 }}>
            Histori langganan
          </FontStyle>
          {mobile ? (
            <Box sx={{ display: "grid", gap: 1.5 }}>
              {items.map((item) => (
                <Box
                  component="section"
                  key={item.id}
                  sx={{ border: `1px solid ${theme.ui.panelBorderSubtle}`, borderRadius: 2, p: 2 }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 1 }}>
                    <FontStyle fontWeight={600}>
                      {fmt(item.starts_on)} – {fmt(item.ends_on)}
                    </FontStyle>
                    <CompactInfoChip status={item.status} />
                  </Box>
                  <FontStyle fontSize={12} sx={{ color: theme.ui.mutedText, mb: 1.5 }}>
                    Tenggang: {fmt(item.grace_ends_on)} · {item.created_by_name || "Migration"}
                  </FontStyle>
                  {actions(item)}
                </Box>
              ))}
            </Box>
          ) : (
            <ModernTableFrame outlined>
              <Table
                rowKey="id"
                dataSource={items}
                columns={columns}
                loading={loading}
                pagination={false}
                scroll={{ x: 800 }}
              />
            </ModernTableFrame>
          )}
        </Box>
      </AppModal>
      <AppModal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={
          action?.type === "suspend"
            ? "Tangguhkan langganan"
            : action?.type === "cancel"
              ? "Batalkan langganan"
              : "Pulihkan langganan"
        }
        description="Alasan akan disimpan pada histori dan audit."
        size="sm"
        footer={
          <>
            <Button onClick={() => setAction(null)}>Batal</Button>
            <Button
              danger={action?.type !== "restore"}
              type="primary"
              onClick={() => actionForm.submit()}
            >
              Simpan
            </Button>
          </>
        }
      >
        <Form form={actionForm} layout="vertical" onFinish={changeStatus}>
          <Form.Item name="reason" label="Alasan" rules={[{ required: true, min: 5 }]}>
            <Input.TextArea rows={4} maxLength={2000} />
          </Form.Item>
        </Form>
      </AppModal>
    </>
  );
}
