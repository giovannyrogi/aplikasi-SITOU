"use client";
import CatalogDocument from "./CatalogDocument";
import { useEffect, useState } from "react";
import { Button, InputNumber } from "antd";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppNotice from "@/app/components/data-display/AppNotice";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { scheduleRequest } from "@/app/components/work-schedules/ScheduleFields";
import HolidayDateList, { displayDate } from "./HolidayDateList";

/** A stage inside the calendar AppModal. Selection is local until the parent calendar is saved. */
export default function CalendarCatalogPicker({ organizationId, days, onReady }) {
  const [year, setYear] = useState(null),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState({ loading: true, error: "", catalog: null, today: null });
  const [selected, setSelected] = useState([]);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState((s) => ({ ...s, loading: true, error: "" }));
      onReady(null);
      try {
        const response = await runWithLoadingBackdrop(
          () =>
            scheduleRequest(
              `/api/holiday-catalogs?organizationId=${organizationId}${year ? `&year=${year}` : ""}`,
              null,
              controller.signal,
            ),
          { message: "Memuat katalog hari libur..." },
        );
        if (controller.signal.aborted) return;
        const data = response.data;
        setState({ ...data, loading: false, error: "" });
        setSelected(
          (data.catalog?.days || [])
            .filter(
              (d) =>
                d.category === "national" &&
                d.date >= data.today &&
                !days.some((p) => p.date === d.date),
            )
            .map((d) => d.id),
        );
      } catch (e) {
        if (!controller.signal.aborted)
          setState((s) => ({ ...s, loading: false, error: e.message, catalog: null }));
      }
    };
    load();
    return () => controller.abort();
  }, [organizationId, year, retry, runWithLoadingBackdrop, days, onReady]);
  const catalog = state.catalog;
  const reason = (d) =>
    d.date < state.today
      ? "Tanggal sudah lewat"
      : days.some((p) => p.date === d.date)
        ? "Sudah ada pada kalender"
        : "";
  useEffect(() => {
    if (state.loading || state.error || !catalog) {
      onReady(null);
      return;
    }
    const additions = catalog.days
      .filter(
        (d) =>
          selected.includes(d.id) && d.date >= state.today && !days.some((p) => p.date === d.date),
      )
      .map((d) => ({
        date: d.date,
        name: d.name,
        catalogDayId: d.id,
        category: d.category,
        catalogYear: catalog.year,
        catalogRevision: catalog.revision,
      }));
    onReady({ days: additions, overflow: days.length + additions.length > 366 });
  }, [selected, catalog, state.loading, state.error, state.today, days, onReady]);
  const changed = days.filter(
    (p) =>
      p.catalogYear === catalog?.year &&
      p.catalogRevision < catalog?.revision &&
      !catalog.days.some(
        (d) => d.date === p.date && d.name === p.name && d.category === p.category,
      ),
  );
  return (
    <Box sx={{ display: "grid", gap: 3, minWidth: 0 }}>
      <Box>
        <FontStyle component="label" htmlFor="catalog-year">
          Tahun katalog
        </FontStyle>
        <InputNumber
          autoFocus
          id="catalog-year"
          aria-label="Tahun katalog"
          value={year || state.year}
          min={2000}
          max={2200}
          precision={0}
          onChange={(v) => {
            if (Number.isInteger(v) && v >= 2000 && v <= 2200) setYear(v);
          }}
          style={{ width: "100%", marginTop: 8 }}
        />
      </Box>
      {state.error ? (
        <AppNotice
          tone="danger"
          title="Katalog belum dapat dimuat"
          description={state.error}
          action={<Button onClick={() => setRetry((n) => n + 1)}>Coba lagi</Button>}
        />
      ) : !state.loading && !catalog ? (
        <AppNotice
          title="Katalog belum tersedia"
          description="Admin SITOU belum menerbitkan katalog untuk tahun ini."
        />
      ) : null}
      {catalog && !state.loading && !state.error && (
        <>
          <AppNotice
            title={`Katalog ${catalog.year} · Revisi ${catalog.revision}`}
            description="Tinjau tanggal yang akan ditambahkan. Cuti bersama tidak mengurangi saldo cuti."
          />
          <FontStyle>
            SKB {catalog.decision_number} ·{" "}
            {catalog.source_url && (
              <a href={catalog.source_url} target="_blank" rel="noopener noreferrer">
                Sumber resmi
              </a>
            )}
          </FontStyle>
          <CatalogDocument catalog={catalog} organizationId={organizationId} />
          {changed.length > 0 && (
            <AppNotice tone="warning" title="Ada perbedaan dengan revisi terbaru">
              <Box sx={{ display: "grid", gap: 1 }}>
                {changed.map((p) => (
                  <FontStyle key={p.date}>
                    {displayDate(p.date)} · {p.name} →{" "}
                    {catalog.days.find((d) => d.date === p.date)?.name ||
                      "Tidak tercantum pada revisi terbaru"}
                  </FontStyle>
                ))}
                <FontStyle>
                  Kalender tersimpan tetap dipertahankan. Hapus tanggal mendatang yang ingin diganti
                  di form, lalu pilih kembali dari katalog.
                </FontStyle>
              </Box>
            </AppNotice>
          )}
          <HolidayDateList
            days={catalog.days}
            selected={selected}
            reason={reason}
            onSelect={(id, checked) =>
              setSelected((s) => (checked ? [...s, id] : s.filter((v) => v !== id)))
            }
          />
          <AppNotice
            title={`Pratinjau: ${selected.length} tanggal dipilih`}
            description="Tambahkan ke form untuk meninjau kembali. Perubahan baru tersimpan saat memilih Simpan kalender."
          />
          {days.length + selected.length > 366 && (
            <AppNotice
              tone="danger"
              title="Batas kalender terlampaui"
              description="Satu kalender maksimal memuat 366 tanggal."
            />
          )}
        </>
      )}
    </Box>
  );
}
