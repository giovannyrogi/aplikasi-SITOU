"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Space, theme } from "antd";
import { Box } from "@mui/material";
import { SearchOutlined } from "@ant-design/icons";
import AsyncSelect from "@/app/components/forms/AsyncSelect";
import { readApiResponse } from "@/lib/api/clientError";
import "leaflet/dist/leaflet.css";

async function geocode(payload, signal) {
  const response = await fetch("/api/locations/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  return (await readApiResponse(response)).data;
}

export default function LocationMapPicker({ latitude, longitude, radius, onError, onPick }) {
  const { token } = theme.useToken();
  const container = useRef(null);
  const searchField = useRef(null);
  const layer = useRef(null);
  const request = useRef(null);
  const [map, setMap] = useState(null);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState();
  const [results, setResults] = useState([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const positioned = useRef(false);

  useEffect(() => {
    let instance;
    let observer;
    let disposed = false;
    const timeout = setTimeout(
      () => setStatus((value) => (value === "loading" ? "error" : value)),
      12000,
    );
    import("leaflet")
      .then(({ default: L }) => {
        if (disposed) return;
        instance = L.map(container.current, {
          scrollWheelZoom: true,
          touchZoom: true,
          maxZoom: 19,
          worldCopyJump: true,
        }).setView([-2.5, 118], 5);
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });
        tiles.on("tileload", () => setStatus("ready"));
        tiles.on("tileerror", () => setStatus((value) => (value === "ready" ? value : "error")));
        tiles.addTo(instance);
        layer.current = L.layerGroup().addTo(instance);
        observer = new ResizeObserver(() => instance.invalidateSize({ pan: true, animate: false }));
        observer.observe(container.current);
        setMap({ instance, L });
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      request.current?.abort();
      observer?.disconnect();
      instance?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map || !layer.current) return;
    layer.current.clearLayers();
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const point = [latitude, longitude];
    map.L.circleMarker(point, {
      radius: 7,
      color: "#d90010",
      fillOpacity: 1,
      interactive: false,
    }).addTo(layer.current);
    if (radius > 0)
      map.L.circle(point, {
        radius,
        color: "#d90010",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(layer.current);
    // Fokus awal saja. Memilih titik tidak mengubah zoom atau area yang sedang dilihat.
    if (!positioned.current) {
      map.instance.setView(point, 17, { animate: false });
      positioned.current = true;
    }
  }, [map, latitude, longitude, radius]);

  useEffect(() => {
    if (!map || status !== "ready") return;
    async function pick(event) {
      request.current?.abort();
      setBusy(false);
      setResults([]);
      const point = event.latlng.wrap();
      const latitude = Number(point.lat.toFixed(7));
      const longitude = Number(point.lng.toFixed(7));
      positioned.current = true;
      const applyAddress = onPick(latitude, longitude);
      const controller = new AbortController();
      request.current = controller;
      setSelected(undefined);
      setQuery("");
      setMessage("");
      try {
        const [result] = await geocode({ latitude, longitude }, controller.signal);
        if (controller.signal.aborted) return;
        if (result) {
          applyAddress(result.address);
          setSelected({ value: "selected", label: result.address });
        }
        if (!result) onError?.("Alamat titik belum ditemukan. Isi alamat secara manual.");
      } catch {
        if (!controller.signal.aborted)
          onError?.("Alamat titik gagal dimuat. Isi alamat secara manual.");
      }
    }
    const element = container.current;
    const pickCenter = (event) => {
      if (event.key !== "Enter" || event.target !== element) return;
      event.preventDefault();
      void pick({ latlng: map.instance.getCenter() });
    };
    map.instance.on("click", pick);
    element.addEventListener("keydown", pickCenter);
    return () => {
      map.instance.off("click", pick);
      element.removeEventListener("keydown", pickCenter);
    };
  }, [map, onPick, status, onError]);

  async function search() {
    const value = query.trim();
    if (busy || value.length < 3) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    searchField.current?.focus();
    setBusy(true);
    setResults([]);
    setMessage("");
    try {
      const matches = await geocode({ query: value }, controller.signal);
      if (controller.signal.aborted) return;
      setResults(matches);
      setResultsOpen(matches.length > 0);
      if (!matches.length)
        setMessage("Lokasi tidak ditemukan. Coba nama tempat atau wilayah lain.");
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error.status === 429
            ? error.message
            : "Pencarian belum tersedia. Pilih titik di peta atau coba lagi.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <Box sx={{ display: "grid", minWidth: 0 }}>
      <Box component="label" htmlFor="location-map-search" sx={{ mb: 1 }}>
        Cari lokasi di peta
      </Box>
      <Space.Compact block style={{ minWidth: 0 }}>
        <AsyncSelect
          ref={searchField}
          labelInValue
          value={selected}
          id="location-map-search"
          style={{ flex: "1 1 0", minWidth: 0, height: token.controlHeight }}
          placeholder="Contoh: Pasar Paal Dua, Manado"
          open={resultsOpen && results.length > 0}
          onOpenChange={setResultsOpen}
          options={results.map((result, index) => ({ value: index, label: result.address }))}
          virtual={false}
          styles={{
            popup: { listItem: { whiteSpace: "normal", overflowWrap: "anywhere", minHeight: 44 } },
          }}
          showSearch={{
            searchValue: query,
            filterOption: false,
            onSearch: (value) => {
              request.current?.abort();
              setBusy(false);
              setSelected(undefined);
              setQuery(value.slice(0, 120));
              setResults([]);
              setResultsOpen(false);
              setMessage("");
            },
          }}
          onKeyDown={(event) => {
            if (
              event.key !== "Enter" ||
              event.nativeEvent.isComposing ||
              (resultsOpen && results.length)
            )
              return;
            event.preventDefault();
            void search();
          }}
          onSelect={(selection) => {
            const result = results[selection.value];
            if (!result) return;
            if (map) positioned.current = true;
            setSelected({ value: "selected", label: result.address });
            onPick(result.latitude, result.longitude, result.address);
            map?.instance.panTo([result.latitude, result.longitude], { animate: false });
            setQuery("");
            setResults([]);
            setResultsOpen(false);
            setMessage("");
            container.current?.focus();
          }}
        />
        <Button
          htmlType="button"
          type="primary"
          icon={<SearchOutlined />}
          style={{ flexShrink: 0, height: token.controlHeight }}
          loading={busy}
          disabled={query.trim().length < 3}
          onClick={search}
        >
          Cari
        </Button>
      </Space.Compact>
      <Box
        ref={container}
        aria-label="Peta lokasi"
        tabIndex={0}
        sx={{
          mt: 2,
          height: { xs: 192, sm: 224 },
          width: "100%",
          zIndex: 0,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
        }}
      />
      {Number.isFinite(latitude) && Number.isFinite(longitude) && (
        <Box
          role="status"
          aria-label="Koordinat lokasi"
          sx={{
            color: "text.disabled",
            mt: 0.5,
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 16px",
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>Latitude: {latitude}</span> <span>Longitude: {longitude}</span>
        </Box>
      )}
      {(status !== "ready" || message) && (
        <Box
          role="status"
          sx={{ mt: 1, color: "text.secondary", fontSize: 13, overflowWrap: "anywhere" }}
        >
          {status === "error"
            ? "Peta belum dapat dimuat. Coba cari lokasi."
            : status === "loading"
              ? "Memuat peta…"
              : null}
          {message && <div>{message}</div>}
        </Box>
      )}
    </Box>
  );
}
