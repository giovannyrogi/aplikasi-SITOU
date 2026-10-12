"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Select, InputNumber } from "antd";
import { Box } from "@mui/material";
import { PlusOutlined, EditOutlined, SettingOutlined, SearchOutlined } from "@ant-design/icons";
import PageHeader from "@/app/components/layout/PageHeader";
import PrerequisiteHint from "@/app/components/forms/PrerequisiteHint";
import usePrerequisiteNavigation from "@/app/hooks/usePrerequisiteNavigation";
import DataPanel from "@/app/components/data-display/DataPanel";
import DataToolbar from "@/app/components/filters/DataToolbar";
import OperationalFilterSection from "@/app/components/filters/OperationalFilterSection";
import ResponsiveDataView from "@/app/components/data-display/ResponsiveDataView";
import InventoryItemGallery from "./InventoryItemGallery";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import RowActionMenu from "@/app/components/actions/RowActionMenu";
import AppModal from "@/app/components/modals/AppModal";
import ConfirmDialog from "@/app/components/actions/ConfirmDialog";
import FormSettingSwitch from "@/app/components/forms/FormSettingSwitch";
import PrivateFileUpload from "@/app/components/forms/PrivateFileUpload";
import FontStyle from "@/app/components/font-style/FontStyle";
import Notification from "@/app/components/Notifications/Notification";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import AppNotice from "@/app/components/data-display/AppNotice";
import useDataList from "@/app/hooks/useDataList";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse, applyApiFieldErrors, ApiRequestError } from "@/lib/api/clientError";
import {
  catalogSchemas,
  catalogUpdateSchemas,
  itemWarehouseSchema,
} from "@/lib/inventory/catalogSchemas";
const NAMES = { items: "barang", categories: "kategori", units: "satuan" };
const STATUS_NAMES = { items: "Barang", categories: "Kategori barang", units: "Satuan barang" };
const formatMinimum = (value) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));
function validatePayload(schema, payload) {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;
  throw new ApiRequestError({
    code: "VALIDATION_ERROR",
    message: result.error.issues[0]?.message || "Periksa kembali isian.",
    fieldErrors: Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
    ),
  });
}
export default function CatalogPanel({ kind, organizationId, organizationFilter }) {
  const list = useDataList(`/api/inventory/catalog/${kind}`, {
    requiredFilter: "organizationId",
    initialFilters: { organizationId },
    infinite: kind === "items",
  });
  const [options, setOptions] = useState(null);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [edit, setEdit] = useState(null);
  const [warehouseItem, setWarehouseItem] = useState(null);
  const [limitsPreview, setLimitsPreview] = useState(null);
  const [preview, setPreview] = useState(null);
  const { notification, showNotification, closeNotification } = useAppNotification();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    void runWithLoadingBackdrop(
      async () => {
        const body = await readApiResponse(
          await fetch(`/api/inventory/catalog/${kind}?organizationId=${organizationId}&options=1`, {
            signal: controller.signal,
            cache: "no-store",
          }),
        );
        if (!controller.signal.aborted) setOptions(body.data);
      },
      { message: "Memuat pilihan katalog..." },
    ).catch((error) => {
      if (error.name !== "AbortError" && !controller.signal.aborted) {
        setOptions(null);
        showNotification(error.message, "error");
      }
    });
    return () => controller.abort();
  }, [kind, organizationId, optionsRevision, runWithLoadingBackdrop, showNotification]);
  const actions = (row) => {
    const values = [];
    if (options?.canManageCatalog)
      values.push({
        key: "edit",
        label: `Edit ${NAMES[kind]}`,
        icon: <EditOutlined />,
        onClick: () => setEdit(row),
      });
    if (kind === "items" && options?.warehouses.some((w) => w.canManage))
      values.push({
        key: "warehouse",
        disabled: !row.is_active,
        label: "Atur barang di gudang",
        icon: <SettingOutlined />,
        onClick: () => setWarehouseItem(row),
      });
    return values.length ? (
      <RowActionMenu
        items={values}
        {...(kind === "items"
          ? {
              triggerIcon: <EditOutlined style={{ fontSize: 19 }} />,
              triggerLabel: `Edit atau atur barang ${row.name}`,
            }
          : {})}
      />
    ) : null;
  };
  const updateItemFilter = (key, value) => {
    const next = { ...list.filters, [key]: value ?? "" };
    if (key === "warehouseId" && value === "unregistered") {
      next.locationId = "";
      next.minimumFrom = "";
      next.minimumTo = "";
    }
    if (key === "locationId") next.warehouseId = "";
    if (
      key === "minimumFrom" &&
      value !== "" &&
      next.minimumTo !== "" &&
      next.minimumTo !== undefined &&
      Number(value) > Number(next.minimumTo)
    )
      next.minimumTo = "";
    if (
      key === "minimumTo" &&
      value !== "" &&
      next.minimumFrom !== "" &&
      next.minimumFrom !== undefined &&
      Number(value) < Number(next.minimumFrom)
    )
      next.minimumFrom = "";
    list.updateFilters(next);
  };
  const itemFilterItems = [
    ...(organizationFilter
      ? [{ key: "organization", label: "Organisasi", control: organizationFilter }]
      : []),
    {
      key: "search",
      label: "Cari barang",
      control: (
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Nama atau kode barang"
          value={list.search}
          onChange={(event) => list.setSearch(event.target.value)}
          aria-label="Cari barang"
          style={{ minHeight: 44 }}
        />
      ),
    },
    {
      key: "status",
      label: "Status",
      control: (
        <Select
          value={list.status}
          onChange={list.setStatus}
          aria-label="Filter status barang"
          options={[
            { value: "all", label: "Semua status" },
            { value: "active", label: "Aktif" },
            { value: "inactive", label: "Nonaktif" },
          ]}
        />
      ),
    },
    {
      key: "location",
      label: "Lokasi",
      control: (
        <Select
          value={list.filters.locationId || "all"}
          onChange={(value) => updateItemFilter("locationId", value === "all" ? "" : value)}
          aria-label="Filter lokasi barang"
          disabled={list.filters.warehouseId === "unregistered"}
          options={[
            { value: "all", label: "Semua lokasi" },
            ...Array.from(
              new Map(
                (options?.warehouses || []).map((warehouse) => [
                  warehouse.location_id,
                  warehouse.location_name,
                ]),
              ).entries(),
            ).map(([value, label]) => ({ value, label })),
          ]}
        />
      ),
    },
    {
      key: "warehouse",
      label: "Pilih gudang",
      control: (
        <Select
          value={list.filters.warehouseId || "all"}
          onChange={(value) => updateItemFilter("warehouseId", value === "all" ? "" : value)}
          aria-label="Filter gudang barang"
          options={[
            { value: "all", label: "Semua gudang" },
            { value: "unregistered", label: "Belum didaftarkan" },
            ...(options?.warehouses || [])
              .filter(
                (warehouse) =>
                  !list.filters.locationId || warehouse.location_id === list.filters.locationId,
              )
              .map((warehouse) => ({
                value: warehouse.id,
                label: `${warehouse.name}${!warehouse.is_active ? " (nonaktif)" : ""}`,
              })),
          ]}
        />
      ),
    },
    {
      key: "minimum",
      label: "Batas stok minimum",
      control: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            "& .ant-input-number": { flex: 1, minWidth: 0, minHeight: 44 },
          }}
        >
          <InputNumber
            min={0}
            max={999999999999}
            value={
              list.filters.minimumFrom === "" || list.filters.minimumFrom === undefined
                ? null
                : Number(list.filters.minimumFrom)
            }
            onChange={(value) =>
              updateItemFilter("minimumFrom", value === null ? "" : String(value))
            }
            disabled={list.filters.warehouseId === "unregistered"}
            placeholder="Dari"
            aria-label="Batas stok minimum dari"
          />
          <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
            –
          </FontStyle>
          <InputNumber
            min={0}
            max={999999999999}
            value={
              list.filters.minimumTo === "" || list.filters.minimumTo === undefined
                ? null
                : Number(list.filters.minimumTo)
            }
            onChange={(value) => updateItemFilter("minimumTo", value === null ? "" : String(value))}
            disabled={list.filters.warehouseId === "unregistered"}
            placeholder="Sampai"
            aria-label="Batas stok minimum sampai"
          />
        </Box>
      ),
    },
  ];
  const columns = [
    {
      title: kind === "categories" ? "Kategori" : "Satuan",
      key: "identity",
      render: (_, row) => (
        <Box sx={{ display: "grid", gap: 0.75, justifyItems: "start", minWidth: 0 }}>
          <FontStyle fontWeight={700}>{row.name}</FontStyle>
          {kind === "categories" ? <CompactInfoChip label={row.code} tone="info" /> : null}
        </Box>
      ),
    },
    ...(kind === "categories"
      ? [
          {
            title: "Catatan",
            dataIndex: "notes",
            width: 320,
            render: (value) => (
              <FontStyle
                explanation={Boolean(value?.trim())}
                fontSize={12}
                sx={{ color: "text.secondary", lineHeight: 1.6, minWidth: 0 }}
              >
                {value?.trim() || "—"}
              </FontStyle>
            ),
          },
        ]
      : []),
    ...(kind === "units"
      ? [
          {
            title: "Jumlah pecahan",
            dataIndex: "allows_fractional",
            render: (v) => (
              <CompactInfoChip
                label={v ? "Pecahan diizinkan" : "Angka bulat"}
                tone={v ? "info" : "neutral"}
              />
            ),
          },
        ]
      : []),
    {
      title: "Status",
      dataIndex: "is_active",
      render: (v) => <CompactInfoChip status={v ? "active" : "inactive"} />,
    },
    {
      title: "Aksi",
      key: "action",
      align: "center",
      width: 88,
      render: (_, row) => (
        <Box sx={{ display: "flex", justifyContent: "center" }}>{actions(row)}</Box>
      ),
    },
  ];
  const card = (row) => (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <FontStyle fontWeight={700} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
          {row.name}
        </FontStyle>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, minWidth: 0 }}>
        {kind === "categories" ? <CompactInfoChip label={row.code} tone="info" /> : null}
        {kind === "units" ? (
          <CompactInfoChip
            label={row.allows_fractional ? "Pecahan diizinkan" : "Angka bulat"}
            tone={row.allows_fractional ? "info" : "neutral"}
          />
        ) : null}
      </Box>
      <CompactInfoChip status={row.is_active ? "active" : "inactive"} />
      {kind === "categories" && row.notes?.trim() ? (
        <Box sx={{ display: "grid", gap: 0.75, minWidth: 0 }}>
          <FontStyle fontSize={11.5} fontWeight={600} sx={{ color: "text.secondary" }}>
            Catatan
          </FontStyle>
          <FontStyle explanation fontSize={12} sx={{ color: "text.secondary", lineHeight: 1.6 }}>
            {row.notes}
          </FontStyle>
        </Box>
      ) : null}
      <Box
        sx={{
          borderTop: "1px solid",
          borderColor: "divider",
          pt: 2,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {actions(row)}
      </Box>
    </Box>
  );
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <PageHeader
        title={
          { items: "Barang Persediaan", categories: "Kategori Barang", units: "Satuan Barang" }[
            kind
          ]
        }
        description={
          organizationId
            ? {
                items: "Kelola barang dan batas minimum per gudang.",
                categories: "Kelompokkan barang agar mudah ditemukan.",
                units: "Kelola satuan untuk pencatatan jumlah barang.",
              }[kind]
            : "Pilih organisasi pada filter untuk membuka data."
        }
        action={
          organizationId && options?.canManageCatalog ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEdit({})}>
              Tambah {NAMES[kind]}
            </Button>
          ) : null
        }
      />
      {kind === "items" ? (
        <OperationalFilterSection
          title="Filter barang persediaan"
          description="Temukan barang berdasarkan nama, status, lokasi, gudang, dan batas stok minimum. Batas ini bukan saldo stok."
          items={itemFilterItems}
          onReset={() => {
            list.setSearch("");
            list.setStatus("all");
            list.updateFilters({ organizationId });
          }}
        />
      ) : null}
      {kind === "items" ? (
        <InventoryItemGallery
          data={list.data}
          loading={list.loading}
          loadingMore={list.loadingMore}
          error={list.error}
          loadMoreError={list.loadMoreError}
          onRetry={list.retryLoadMore}
          onRefresh={() => {
            setOptionsRevision((current) => current + 1);
            void list.refresh();
          }}
          onLoadMore={list.loadMore}
          pagination={list.pagination}
          organizationId={organizationId}
          actions={actions}
          onPreview={setPreview}
          onLimitsPreview={setLimitsPreview}
        />
      ) : (
        <DataPanel
          title={`Daftar ${NAMES[kind]}`}
          description={
            list.loading
              ? "Memuat katalog..."
              : `${list.pagination.total} data. ${options?.canManageCatalog ? "Kelola data bersama organisasi." : "Data bersama organisasi; perubahan hanya oleh Pengelola Master Inventaris."}`
          }
          toolbar={
            <DataToolbar
              embedded
              search={list.search}
              onSearchChange={list.setSearch}
              status={list.status}
              onStatusChange={list.setStatus}
              onRefresh={() => {
                setOptionsRevision((current) => current + 1);
                void list.refresh();
              }}
              filters={organizationFilter}
            />
          }
        >
          <ResponsiveDataView
            data={list.data}
            columns={columns}
            renderCard={card}
            loading={list.loading}
            error={list.error}
            emptyDescription={
              !organizationId ? "Pilih organisasi pada filter untuk menampilkan data." : undefined
            }
            onRetry={list.refresh}
            pagination={list.pagination}
            onPageChange={list.setPage}
            scrollX={900}
          />
        </DataPanel>
      )}
      <CatalogForm
        kind={kind}
        item={edit}
        organizationId={organizationId}
        options={options}
        onClose={() => setEdit(null)}
        onSaved={async (message) => {
          setEdit(null);
          showNotification(message);
          await list.refresh();
        }}
        onError={(message) => showNotification(message, "error")}
      />
      <ItemWarehouseForm
        item={warehouseItem}
        organizationId={organizationId}
        options={options}
        onClose={() => setWarehouseItem(null)}
        onSaved={async (message) => {
          showNotification(message);
          await list.refresh();
        }}
        onError={(message) => showNotification(message, "error")}
      />
      <ImagePreviewModal
        open={Boolean(preview)}
        imageUrl={
          preview
            ? `/api/uploads/${encodeURIComponent(preview.photo_file_id)}?organizationId=${encodeURIComponent(organizationId)}`
            : undefined
        }
        alt={preview?.name}
        title="Foto barang"
        onClose={() => setPreview(null)}
      />
      <AppModal
        open={Boolean(limitsPreview)}
        title="Batas stok minimum per gudang"
        description={limitsPreview?.name}
        icon="inventory:warehouse"
        size="sm"
        onClose={() => setLimitsPreview(null)}
      >
        <Box sx={{ display: "grid", gap: 2 }}>
          {(limitsPreview?.warehouse_limits || []).map((limit) => (
            <Box
              key={limit.warehouse_name}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                minWidth: 0,
                borderBottom: "1px solid",
                borderColor: "divider",
                pb: 1.5,
              }}
            >
              <FontStyle fontSize={13} sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                {limit.warehouse_name}
              </FontStyle>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <FontStyle fontSize={13} fontWeight={700}>
                  {formatMinimum(limit.minimum_stock)} {limitsPreview?.unit_name}
                </FontStyle>
                {!limit.is_active ? (
                  <FontStyle fontSize={11} sx={{ color: "text.secondary" }}>
                    Tidak digunakan
                  </FontStyle>
                ) : null}
              </Box>
            </Box>
          ))}
        </Box>
      </AppModal>
      <Notification {...notification} onClose={closeNotification} />
    </Box>
  );
}
function CatalogForm({ kind, item, organizationId, options, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const dirty = useRef(false);
  const { close, navigate } = usePrerequisiteNavigation(form, onClose, () => dirty.current);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [pending, setPending] = useState(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    if (!item) return;
    dirty.current = false;
    form.resetFields();
    form.setFieldsValue(
      item.id
        ? {
            ...(kind !== "units" ? { code: item.code } : {}),
            name: item.name,
            notes: item.notes,
            isActive: item.is_active,
            categoryId: item.category_id,
            unitId: item.unit_id,
            allowsFractional: item.allows_fractional,
          }
        : { isActive: true, allowsFractional: false },
    );
    Promise.resolve().then(() =>
      setPhoto(
        item.photo_file_id
          ? {
              id: item.photo_file_id,
              name: item.photo_name,
              mime_type: item.photo_mime,
              size_bytes: item.photo_size,
            }
          : null,
      ),
    );
  }, [item, form, kind]);
  const save = async (values) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const payload = validatePayload(
            item.id ? catalogUpdateSchemas[kind] : catalogSchemas[kind],
            {
              ...values,
              notes: values.notes || null,
              organizationId: Number(organizationId),
              ...(item.id ? { version: item.version } : {}),
              ...(kind === "items"
                ? { photoAction: item.photo_file_id && !photo ? "remove" : "keep" }
                : {}),
            },
          );
          const body = new FormData();
          body.append("payload", JSON.stringify(payload));
          if (photo?.localFile) body.append("file", photo.localFile);
          const result = await readApiResponse(
            await fetch(`/api/inventory/catalog/${kind}${item.id ? `/${item.id}` : ""}`, {
              method: item.id ? "PATCH" : "POST",
              body,
            }),
          );
          await onSaved(result.message);
        },
        { message: "Menyimpan katalog..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      onError(error.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const choices = (rows, id) =>
    rows.map((row) => ({
      value: row.id,
      label: `${row.name}${!row.is_active ? " (Nonaktif)" : ""}`,
      disabled: !row.is_active && row.id !== id,
    }));
  return (
    <>
      <AppModal
        open={Boolean(item)}
        title={`${item?.id ? "Edit" : "Tambah"} ${NAMES[kind]}`}
        icon="inventory:catalog"
        description="Data ini digunakan bersama dalam satu organisasi."
        onClose={close.requestClose}
        disableClose={saving}
        footer={
          <>
            <Button disabled={saving} onClick={close.requestClose}>
              Batal
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              Simpan {NAMES[kind]}
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            dirty.current = true;
          }}
          onFinish={(v) => {
            if (item?.is_active && !v.isActive) setPending(v);
            else void save(v);
          }}
          onFinishFailed={({ errorFields }) => {
            onError("Periksa kembali isian katalog.");
            if (errorFields[0]) form.scrollToField(errorFields[0].name, { focus: true });
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                kind === "units"
                  ? "minmax(0,1fr)"
                  : { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" },
              gap: 2,
              minWidth: 0,
            }}
          >
            {kind !== "units" ? (
              <Form.Item
                name="code"
                label="Kode"
                rules={[
                  { required: true, message: "Kode wajib diisi." },
                  {
                    pattern: /^[A-Za-z0-9_-]+$/,
                    message: "Gunakan huruf, angka, garis bawah atau tanda hubung.",
                  },
                ]}
              >
                <Input maxLength={40} />
              </Form.Item>
            ) : null}
            <Form.Item
              name="name"
              label="Nama"
              rules={[{ required: true, whitespace: true, message: "Nama wajib diisi." }]}
            >
              <Input maxLength={kind === "items" ? 160 : 100} />
            </Form.Item>
          </Box>
          {kind === "items" ? (
            <>
              <Form.Item
                name="categoryId"
                label="Kategori"
                extra={
                  options && !options.categories.some((row) => row.is_active) ? (
                    <PrerequisiteHint
                      text={
                        options.categories.length
                          ? "Belum ada kategori aktif. Aktifkan atau buat kategori melalui Data Master → Kategori Barang."
                          : "Buat kategori terlebih dahulu melalui Data Master → Kategori Barang → Tambah kategori."
                      }
                      href={`/master-data/inventory-categories?organizationId=${organizationId}`}
                      onNavigate={navigate}
                      linkLabel="Buka Kategori Barang"
                    />
                  ) : undefined
                }
                rules={[{ required: true, message: "Kategori wajib dipilih." }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={choices(options?.categories || [], item?.category_id)}
                  notFoundContent="Tidak ada kategori yang sesuai."
                />
              </Form.Item>
              <Form.Item
                name="unitId"
                label="Satuan dasar"
                extra={
                  item?.unit_locked ? (
                    <AppNotice
                      compact
                      tone="info"
                      title="Satuan terkunci"
                      description="Barang sudah digunakan dalam pengaturan gudang, sehingga satuan dasarnya tidak dapat diubah."
                    />
                  ) : options && !options.units.some((row) => row.is_active) ? (
                    <PrerequisiteHint
                      text={
                        options.units.length
                          ? "Belum ada satuan aktif. Aktifkan atau buat satuan melalui Data Master → Satuan Barang."
                          : "Buat satuan terlebih dahulu melalui Data Master → Satuan Barang → Tambah satuan."
                      }
                      href={`/master-data/inventory-units?organizationId=${organizationId}`}
                      onNavigate={navigate}
                      linkLabel="Buka Satuan Barang"
                    />
                  ) : undefined
                }
                rules={[{ required: true, message: "Satuan wajib dipilih." }]}
              >
                <Select
                  disabled={Boolean(item?.unit_locked)}
                  showSearch
                  optionFilterProp="label"
                  options={choices(options?.units || [], item?.unit_id)}
                  notFoundContent="Tidak ada satuan yang sesuai."
                />
              </Form.Item>
              <Form.Item label="Foto barang (opsional)">
                <PrivateFileUpload
                  deferred
                  selectedText={
                    photo?.pending
                      ? "Pratinjau lokal; belum disimpan"
                      : "Foto tersimpan secara privat"
                  }
                  value={photo}
                  organizationId={organizationId}
                  onChange={(value) => {
                    dirty.current = true;
                    setPhoto(value);
                  }}
                  onError={onError}
                  accept=".jpg,.jpeg,.png,.webp"
                  maxSizeBytes={5 * 1024 * 1024}
                  helpText="JPEG, PNG, atau WebP maksimal 5 MB. Foto disimpan setelah Anda menyimpan barang."
                />
              </Form.Item>
            </>
          ) : null}
          <Form.Item
            name="notes"
            label={kind === "categories" ? "Catatan (opsional)" : "Keterangan (opsional)"}
          >
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          {kind === "units" ? (
            <FormSettingSwitch
              name="allowsFractional"
              title="Jumlah pecahan diizinkan"
              description="Aktifkan untuk satuan seperti liter atau kilogram. Satuan buah dan rim dapat menggunakan angka bulat."
              disabled={Boolean(item?.quantity_locked)}
              disabledReason="Aturan pecahan terkunci karena satuan sudah digunakan oleh barang."
            />
          ) : null}
          <FormSettingSwitch
            name="isActive"
            notice={{
              on: {
                title: `${STATUS_NAMES[kind]} aktif`,
                description:
                  "Data ini dapat dipilih untuk pencatatan baru. Data dan riwayat sebelumnya tetap tersimpan.",
              },
              off: {
                title: `${STATUS_NAMES[kind]} tidak aktif`,
                description:
                  "Jika dinonaktifkan, data ini tidak dapat dipilih untuk pencatatan baru. Data dan riwayat sebelumnya tetap tersimpan.",
              },
            }}
          />
        </Form>
      </AppModal>
      <ConfirmDialog
        open={Boolean(pending)}
        title={`Nonaktifkan ${NAMES[kind]}?`}
        message="Data tetap tersimpan untuk menjaga referensi dan riwayat."
        confirmText="Nonaktifkan"
        danger
        onClose={() => setPending(null)}
        onConfirm={() => {
          const values = pending;
          setPending(null);
          void save(values);
        }}
      />
      <ConfirmDialog
        open={close.confirmCloseOpen}
        title="Tutup tanpa menyimpan?"
        message="Perubahan katalog belum disimpan."
        confirmText="Tutup"
        onClose={close.keepEditing}
        onConfirm={close.discardChanges}
      />
    </>
  );
}
function ItemWarehouseForm({ item, organizationId, options, onClose, onSaved, onError }) {
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const { close, navigate } = usePrerequisiteNavigation(form, onClose, () => dirty.current);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const errors = useRef(onError);
  useEffect(() => {
    errors.current = onError;
  }, [onError]);
  const warehouseId = Form.useWatch("warehouseId", form);
  useEffect(() => {
    if (!item) return;
    dirty.current = false;
    form.resetFields();
    void runWithLoadingBackdrop(
      async () => {
        setReady(false);
        const result = await readApiResponse(
          await fetch(
            `/api/inventory/catalog/items/${item.id}/warehouses?organizationId=${organizationId}`,
          ),
        );
        setRows(result.data);
        setReady(true);
      },
      { message: "Memuat pengaturan gudang..." },
    ).catch((e) => errors.current(e.message));
  }, [item, organizationId, form, runWithLoadingBackdrop]);
  useEffect(() => {
    if (!warehouseId || !ready) return;
    const row = rows.find((r) => r.warehouse_id === warehouseId);
    form.setFieldsValue({
      minimumStock: row ? Number(row.minimum_stock) : 0,
      isActive: row?.is_active ?? true,
    });
  }, [warehouseId, rows, ready, form]);
  const save = async (values) => {
    if (saving) return;
    setSaving(true);
    try {
      await runWithLoadingBackdrop(
        async () => {
          const row = rows.find((r) => r.warehouse_id === values.warehouseId);
          const result = await readApiResponse(
            await fetch(`/api/inventory/catalog/items/${item.id}/warehouses`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                validatePayload(itemWarehouseSchema, {
                  ...values,
                  organizationId: Number(organizationId),
                  version: row?.version || 0,
                }),
              ),
            }),
          );
          onSaved(result.message);
          onClose();
        },
        { message: "Menyimpan pengaturan barang..." },
      );
    } catch (error) {
      applyApiFieldErrors(form, error);
      onError(error.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <AppModal
        open={Boolean(item)}
        title="Atur barang di gudang"
        description={item?.name}
        icon="inventory:warehouse"
        onClose={close.requestClose}
        disableClose={saving}
        footer={
          <>
            <Button disabled={saving} onClick={close.requestClose}>
              Batal
            </Button>
            <Button type="primary" loading={saving} disabled={!ready} onClick={() => form.submit()}>
              Simpan pengaturan
            </Button>
          </>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            dirty.current = true;
          }}
          onFinish={save}
          onFinishFailed={({ errorFields }) => {
            onError("Periksa kembali pengaturan gudang.");
            if (errorFields[0]) form.scrollToField(errorFields[0].name, { focus: true });
          }}
        >
          <Form.Item
            name="warehouseId"
            label="Gudang"
            extra={
              ready && options && !options.warehouses.some((w) => w.canManage && w.is_active) ? (
                <PrerequisiteHint
                  text="Belum ada gudang aktif dalam cakupan pengelolaan Anda. Periksa melalui Data Master → Gudang atau minta bantuan pengelola akses."
                  href={`/master-data/inventory-warehouses?organizationId=${organizationId}`}
                  onNavigate={navigate}
                  linkLabel="Buka Gudang"
                />
              ) : undefined
            }
            rules={[{ required: true, message: "Pilih gudang." }]}
          >
            <Select
              options={(options?.warehouses || [])
                .filter((w) => w.canManage && w.is_active)
                .map((w) => ({ value: w.id, label: w.name }))}
            />
          </Form.Item>
          <Form.Item
            name="minimumStock"
            label={`Batas stok minimum (${item?.unit_name || "satuan dasar"})`}
            rules={[{ required: true, message: "Batas minimum wajib diisi." }]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0}
              max={999999999999}
              precision={item?.allows_fractional ? undefined : 0}
              decimalSeparator=","
              style={{ width: "100%" }}
            />
          </Form.Item>
          <AppNotice
            tone="info"
            title="Batas stok minimum menentukan kapan peringatan muncul"
            description="Saat fitur stok tersedia, sistem akan memberi peringatan jika sisa stok di gudang ini mencapai atau turun di bawah angka yang Anda isi. Angka ini tidak menambah stok barang; stok masuk dan keluar dicatat melalui transaksi."
            sx={{ mt: 2, mb: 1 }}
          />
          {warehouseId ? (
            <FormSettingSwitch
              name="isActive"
              notice={{
                on: {
                  title: "Barang aktif di gudang ini",
                  description:
                    "Barang dapat dipilih untuk transaksi stok di gudang ini saat fitur transaksi tersedia. Batas minimum akan dipakai untuk memberi peringatan saat sisa stok mencapai atau turun di bawahnya.",
                },
                off: {
                  title: "Barang tidak aktif di gudang ini",
                  description:
                    "Jika dinonaktifkan, barang tidak dapat dipilih atau digunakan pada transaksi stok di gudang ini. Pengaturan batas minimum dan riwayatnya tetap tersimpan; aktifkan kembali untuk menggunakannya.",
                },
              }}
            />
          ) : null}
        </Form>
      </AppModal>
      <ConfirmDialog
        open={close.confirmCloseOpen}
        title="Tutup tanpa menyimpan?"
        message="Pengaturan barang belum disimpan."
        confirmText="Tutup"
        onClose={close.keepEditing}
        onConfirm={close.discardChanges}
      />
    </>
  );
}
