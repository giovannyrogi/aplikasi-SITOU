"use client";

import { useEffect, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ConfigProvider, Segmented, Select } from "antd";
import { AimOutlined, ColumnWidthOutlined, RightOutlined } from "@ant-design/icons";
import AppNotice from "@/app/components/data-display/AppNotice";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import PhotoAvatar from "@/app/components/data-display/PhotoAvatar";
import FontStyle from "@/app/components/font-style/FontStyle";
import {
  attendanceClock,
  attendanceIndicator,
  attendanceIndicatorLabel,
  attendanceLocalDate,
} from "@/lib/reports/attendancePresentation.mjs";
import { reportDate } from "./ReportEmployeeFields";
import { attendanceIndicatorIcon, attendanceIndicatorIconTone } from "./AttendanceSummaryFields";
import "leaflet/dist/leaflet.css";

const pointColor = "#d90010";
const employeeColor = "#334b72";
const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
const googleMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
let googleLoader;

function loadGoogleMaps() {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  googleLoader ??= new Promise((resolve, reject) => {
    const callback = "sitouAttendanceGoogleMapsReady";
    const script = document.createElement("script");
    const query = new URLSearchParams({
      key: googleKey,
      loading: "async",
      callback,
      v: "quarterly",
    });
    const timeout = setTimeout(fail, 15000);
    function fail() {
      clearTimeout(timeout);
      delete window[callback];
      script.remove();
      googleLoader = undefined;
      reject(new Error("Google Maps tidak dapat dimuat."));
    }
    window[callback] = () => {
      clearTimeout(timeout);
      delete window[callback];
      resolve(window.google.maps);
    };
    script.onerror = fail;
    script.src = "https://maps.googleapis.com/maps/api/js?" + query;
    script.nonce = document.querySelector("script[nonce]")?.nonce || "";
    script.async = true;
    document.head.append(script);
  });
  return googleLoader;
}

function coordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

function markerElement({ employee, name, photo }) {
  const marker = document.createElement("span");
  marker.className = employee ? "attendance-map-marker employee" : "attendance-map-marker";
  marker.title = employee ? "Posisi " + name : "Titik absensi";
  marker.textContent = employee
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => Array.from(word)[0])
        .join("")
    : "";
  if (employee && photo) {
    const image = document.createElement("img");
    image.alt = "";
    image.addEventListener("error", () => image.remove(), { once: true });
    image.src = photo;
    marker.append(image);
  }
  return marker;
}

function mapLocations(event) {
  return {
    point: coordinates(event.point_latitude, event.point_longitude),
    position: coordinates(event.latitude, event.longitude),
  };
}

function EventMapCanvas({ event, provider, name, photo }) {
  const container = useRef(null);
  const panTo = useRef(null);
  const [state, setState] = useState("loading");
  const { point, position } = mapLocations(event);
  const center = point || position;
  const missingGoogle = provider === "google" && (!googleKey || !googleMapId);

  useEffect(() => {
    const { point, position } = mapLocations(event);
    const center = point || position;
    const radius = Number(event.radius_m);
    if (missingGoogle || !center) return;
    const element = container.current;
    let disposed = false;
    let cleanup;
    const timeout = setTimeout(() => setState("error"), 15000);
    const ready = () => {
      clearTimeout(timeout);
      if (!disposed) setState("ready");
    };
    async function mount() {
      if (provider === "google") {
        const maps = await loadGoogleMaps();
        const [{ Map: GoogleMap, Circle }, { AdvancedMarkerElement }] = await Promise.all([
          maps.importLibrary("maps"),
          maps.importLibrary("marker"),
        ]);
        if (disposed) return;
        const map = new GoogleMap(element, {
          center,
          zoom: 17,
          mapId: googleMapId,
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        panTo.current = (location) => {
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            map.setCenter(location);
          else map.panTo(location);
        };
        const bounds = new maps.LatLngBounds();
        const markers = [];
        const circle =
          point && radius > 0
            ? new Circle({
                map,
                center: point,
                radius,
                strokeColor: pointColor,
                strokeOpacity: 0.85,
                strokeWeight: 2,
                fillColor: pointColor,
                fillOpacity: 0.14,
                clickable: false,
              })
            : null;
        if (circle?.getBounds()) bounds.union(circle.getBounds());
        for (const [location, employee] of [
          [point, false],
          [position, true],
        ]) {
          if (!location) continue;
          bounds.extend(location);
          const marker = new AdvancedMarkerElement({
            map,
            position: location,
            title: employee ? "Posisi " + name : "Titik absensi",
            anchorTop: "-50%",
            zIndex: employee ? 2 : 1,
          });
          marker.append(markerElement({ employee, name, photo }));
          markers.push(marker);
        }
        if (
          circle ||
          (point && position && (point.lat !== position.lat || point.lng !== position.lng))
        ) {
          map.fitBounds(bounds, 32);
        }
        const loaded = maps.event.addListenerOnce(map, "tilesloaded", ready);
        cleanup = () => {
          loaded.remove();
          markers.forEach((marker) => {
            marker.map = null;
          });
          circle?.setMap(null);
          element.replaceChildren();
        };
        return;
      }
      const { default: L } = await import("leaflet");
      if (disposed) return;
      const map = L.map(element, {
        scrollWheelZoom: true,
        // Switching attendance records can remove this map before a zoom transition ends.
        zoomAnimation: false,
        maxZoom: 19,
      }).setView(center, 17);
      panTo.current = ({ lat, lng }) =>
        map.panTo([lat, lng], {
          animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        });
      cleanup = () => map.remove();
      const bounds = L.latLngBounds([]);
      if (point && radius > 0) {
        const circle = L.circle(point, {
          radius,
          color: pointColor,
          weight: 2,
          fillOpacity: 0.14,
          interactive: false,
        }).addTo(map);
        bounds.extend(circle.getBounds());
      }
      for (const [location, employee] of [
        [point, false],
        [position, true],
      ]) {
        if (!location) continue;
        bounds.extend(location);
        const icon = L.divIcon({
          className: "attendance-map-pin",
          html: markerElement({ employee, name, photo }),
          iconSize: employee ? [34, 34] : [14, 14],
        });
        L.marker(location, {
          icon,
          title: employee ? "Posisi " + name : "Titik absensi",
          zIndexOffset: employee ? 100 : 0,
        }).addTo(map);
      }
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17, animate: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
        .on("tileload", ready)
        .addTo(map);
    }
    mount().catch(() => {
      clearTimeout(timeout);
      if (!disposed) setState("error");
    });
    return () => {
      disposed = true;
      panTo.current = null;
      clearTimeout(timeout);
      cleanup?.();
    };
  }, [event, provider, name, photo, missingGoogle]);

  const legendProps = { event, name, photo };
  function centerMap(location) {
    panTo.current?.(location);
    container.current?.scrollIntoView({ block: "nearest" });
  }
  if (!center)
    return (
      <>
        <AppNotice tone="info" description="Koordinat belum tersimpan untuk absen ini." />
        <MapLegend {...legendProps} />
      </>
    );
  if (missingGoogle) {
    return (
      <>
        <AppNotice
          tone="info"
          description="Google Maps belum disiapkan untuk dashboard. Hubungi Admin SITOU."
        />
        <MapLegend {...legendProps} />
      </>
    );
  }
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box
        sx={{
          position: "relative",
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: (theme) => `0 5px 12px ${alpha(theme.palette.text.primary, 0.14)}`,
          "& .attendance-map-marker": {
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: 14,
            height: 14,
            bgcolor: pointColor,
            color: "common.white",
            border: 0,
            borderRadius: "50%",
            boxShadow: "0 3px 7px rgba(16, 30, 53, 0.30), inset 0 1px 2px rgba(255,255,255,0.42)",
            fontWeight: 700,
            fontSize: 11,
            overflow: "hidden",
          },
          "& .attendance-map-marker.employee": {
            width: 34,
            height: 34,
            bgcolor: employeeColor,
            border: "2px solid white",
          },
          "& .attendance-map-marker img": {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          },
        }}
      >
        <Box
          ref={container}
          role="region"
          aria-label="Peta titik absensi dan posisi Pegawai"
          sx={{ height: { xs: 210, sm: 250 }, bgcolor: "action.hover", isolation: "isolate" }}
        />
        {state === "loading" && (
          <Box
            role="status"
            sx={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              bgcolor: "background.paper",
              p: 1,
              borderRadius: 1,
            }}
          >
            Memuat peta…
          </Box>
        )}
      </Box>
      {state === "error" && <AppNotice tone="warning" description="Peta tidak dapat dimuat." />}
      <MapLegend {...legendProps} onCenter={state === "ready" ? centerMap : undefined} />
    </Box>
  );
}

function formatDistance(meters) {
  if (meters == null || !Number.isFinite(Number(meters)) || Number(meters) < 0) return "—";
  const whole = Math.round(Number(meters));
  if (whole < 1000) return `${whole} m`;
  const km = Math.floor(whole / 1000).toLocaleString("id-ID");
  const remaining = whole % 1000;
  return remaining ? `${km} km ${remaining} m` : `${km} km`;
}

function LegendIcon({ Icon, tone }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        display: "grid",
        placeItems: "center",
        width: 28,
        height: 28,
        borderRadius: 2,
        color: theme.status[tone]?.main || theme.palette[tone]?.dark,
        background: `linear-gradient(150deg, ${theme.palette.background.paper}, ${alpha(theme.status[tone]?.main || theme.palette[tone]?.main || theme.palette.info.main, 0.14)})`,
        boxShadow: "0 2px 4px rgba(16, 30, 53, 0.13), inset 0 1px rgba(255,255,255,0.85)",
      })}
    >
      <Icon />
    </Box>
  );
}

function MapFacts({ items, label }) {
  return (
    <Box
      component="dl"
      aria-label={label}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" },
        gap: 1,
        m: 0,
      }}
    >
      {items.map(([label, value, marker, key, action]) => (
        <Box
          key={key ?? label}
          sx={{
            display: "flex",
            position: "relative",
            alignItems: "center",
            gap: 1,
            p: 1.25,
            ...(action && {
              pr: 3,
              "&:hover": { borderColor: "primary.main" },
              "&:focus-within": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: 2,
              },
            }),
            minWidth: 0,
            overflowWrap: "anywhere",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            background: (theme) =>
              `linear-gradient(150deg, ${theme.palette.background.paper}, ${theme.ui.panelSubtleBg})`,
            boxShadow: "0 2px 4px rgba(16, 30, 53, 0.06)",
          }}
        >
          <Box sx={{ display: "grid", placeItems: "center", width: 28, flexShrink: 0 }}>
            {marker}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FontStyle component="dt" fontSize={12} fontWeight={650}>
              {action ? (
                <Box
                  component="button"
                  type="button"
                  onClick={action}
                  aria-label={`Pusatkan peta ke ${label.toLowerCase()}`}
                  sx={{
                    p: 0,
                    border: 0,
                    bgcolor: "transparent",
                    color: "inherit",
                    font: "inherit",
                    textAlign: "start",
                    cursor: "pointer",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      inset: 0,
                      borderRadius: "inherit",
                    },
                  }}
                >
                  {label}
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "primary.dark",
                    }}
                  >
                    <RightOutlined />
                  </Box>
                </Box>
              ) : (
                label
              )}
            </FontStyle>
            <FontStyle
              component="dd"
              fontSize={12}
              color="text.secondary"
              sx={{ m: 0, fontVariantNumeric: "tabular-nums" }}
            >
              {value}
            </FontStyle>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function MapLegend({ event, name, photo, onCenter }) {
  const { point, position } = mapLocations(event);
  return (
    <MapFacts
      label="Informasi lokasi absensi"
      items={[
        [
          "Titik absensi",
          event.point_name_snapshot || (point ? "Titik terdaftar" : "Tidak tercatat"),
          <Box
            key="point"
            aria-hidden
            sx={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              bgcolor: pointColor,
              boxShadow: "0 0 0 4px rgba(217,0,16,.11)",
            }}
          />,
          "point",
          onCenter && point ? () => onCenter(point) : undefined,
        ],
        [
          "Posisi Pegawai",
          position ? "Lokasi saat absen" : "Tidak tercatat",
          <PhotoAvatar key={photo} name={name} photoUrl={photo} size={28} interactive={false} />,
          "position",
          onCenter && position ? () => onCenter(position) : undefined,
        ],
        [
          "Jarak dari titik",
          formatDistance(event.distance_from_point_m),
          <LegendIcon key="distance" Icon={ColumnWidthOutlined} tone="info" />,
        ],
        [
          "Radius absensi",
          formatDistance(event.radius_m),
          <LegendIcon key="radius" Icon={AimOutlined} tone="primary" />,
        ],
      ]}
    />
  );
}

function eventIndicators(event) {
  return [
    ...new Set(
      [
        !event.assessment_version
          ? "unassessed"
          : event.timing_category === "on_time"
            ? "on_time_" + event.event_type
            : event.timing_category,
        event.geofence_status === "outside" && "outside_radius",
        event.near_boundary && "near_boundary",
        event.work_context,
      ].filter(attendanceIndicator),
    ),
  ];
}

function IndicatorFacts({ events, rowIndicators, rowMetrics }) {
  const items = [];
  for (const event of events) {
    for (const key of eventIndicators(event)) {
      items.push({
        key,
        context: event.event_type === "check_in" ? "Absen masuk" : "Absen pulang",
        metrics: event,
      });
    }
  }
  for (const key of rowIndicators.filter(attendanceIndicator)) {
    items.push({ key, context: "Rekap harian", metrics: rowMetrics });
  }
  if (!items.length) return null;
  return (
    <MapFacts
      label="Indikator absensi"
      items={items.map(({ key, context, metrics }, index) => {
        const [, tone] = attendanceIndicator(key);
        const Icon = attendanceIndicatorIcon(key);
        return [
          context,
          <CompactInfoChip
            key={key}
            label={attendanceIndicatorLabel(key, metrics)}
            tone={tone}
            wrap
          />,
          <LegendIcon key={key} Icon={Icon} tone={attendanceIndicatorIconTone(tone)} />,
          index,
        ];
      })}
    />
  );
}

export default function AttendanceEventMap({
  events,
  provider,
  name,
  photo,
  timezone,
  allowed,
  rowIndicators,
  rowMetrics,
}) {
  const theme = useTheme();
  const [selection, setSelection] = useState(null);
  const recordedIndicators = new Set(events.flatMap(eventIndicators));
  const summaryIndicators = rowIndicators.filter((key) => !recordedIndicators.has(key));
  if (!allowed) {
    const pointNames = [
      ...new Set(events.map((event) => event.point_name_snapshot).filter(Boolean)),
    ];
    return (
      <>
        <AppNotice tone="info" description="Akun Anda belum memiliki izin melihat peta absensi." />
        {pointNames.length > 0 && (
          <FontStyle color="text.secondary">Titik absensi · {pointNames.join(", ")}</FontStyle>
        )}
        <IndicatorFacts events={events} rowIndicators={summaryIndicators} rowMetrics={rowMetrics} />
      </>
    );
  }
  if (!events.length)
    return (
      <>
        <AppNotice tone="info" description="Belum ada posisi absensi yang tercatat." />
        <IndicatorFacts events={events} rowIndicators={summaryIndicators} rowMetrics={rowMetrics} />
      </>
    );
  const options = events.map((event) => {
    const zone = event.organization_timezone_snapshot || timezone;
    const label = event.event_type === "check_in" ? "Masuk" : "Pulang";
    return {
      value: `${event.event_date}-${event.id}`,
      label: `${label} · ${reportDate(attendanceLocalDate(event.occurred_at, zone))} · ${attendanceClock(event.occurred_at, zone)}`,
    };
  });
  const index = options.findIndex(({ value }) => value === selection);
  const selected = options[Math.max(0, index)];
  const event = events[Math.max(0, index)];
  const distinctDirections =
    new Set(events.map(({ event_type }) => event_type)).size === events.length;
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        minWidth: 0,
        "& .ant-segmented": {
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          width: "100%",
          maxWidth: "100%",
        },
        "& .ant-segmented .ant-segmented-item": {
          minHeight: { xs: 44, sm: 34 },
          display: "grid",
          placeItems: "center",
        },
        "& .ant-segmented .ant-segmented-item-label": { minHeight: 0, lineHeight: 1.35 },
        "& .ant-segmented .ant-segmented-item-selected .ant-segmented-item-label": {
          color: "primary.contrastText",
          fontWeight: 650,
        },
      }}
    >
      {distinctDirections ? (
        <ConfigProvider
          theme={{
            components: {
              Segmented: {
                itemSelectedBg: theme.palette.primary.dark,
                itemSelectedColor: theme.palette.primary.contrastText,
              },
            },
          }}
        >
          <Segmented
            block
            aria-label="Pilih absen untuk ditampilkan pada peta"
            options={[
              ["check_in", "Masuk"],
              ["check_out", "Pulang"],
            ].map(([type, label]) => {
              const option = options[events.findIndex((event) => event.event_type === type)];
              return { label, value: option?.value || type, disabled: !option };
            })}
            value={selected.value}
            onChange={setSelection}
          />
        </ConfigProvider>
      ) : (
        <Select
          aria-label="Pilih absen untuk ditampilkan pada peta"
          options={options}
          value={selected.value}
          onChange={setSelection}
        />
      )}
      <EventMapCanvas
        key={`${provider}-${selected.value}`}
        event={event}
        provider={provider}
        name={name}
        photo={photo}
      />
      <IndicatorFacts events={events} rowIndicators={summaryIndicators} rowMetrics={rowMetrics} />
    </Box>
  );
}
