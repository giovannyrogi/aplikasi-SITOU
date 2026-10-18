"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Box, IconButton, useMediaQuery, useTheme } from "@mui/material";
import { useAuthenticatedUser } from "@/app/components/auth/AuthenticatedUserProvider";
import {
  adjacentBalance,
  leaveBalanceCardMetric,
  selectableBalances,
  selectedBalance,
  shouldAutoRotateBalance,
} from "@/lib/dashboard/personalPresentation.mjs";
import DashboardMetric from "./DashboardMetric";

const memory = new Map();
function subscribe(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("sitou:balance-selection", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("sitou:balance-selection", callback);
  };
}
export default function EmployeeBalanceMetric({ balances }) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const user = useAuthenticatedUser();
  const pointer = useRef(null);
  const cardRef = useRef(null);
  const [direction, setDirection] = useState(1);
  const [hasMoved, setHasMoved] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [cardVisible, setCardVisible] = useState(true);
  const storageKey = `sitou:leave-balance:${user.organization_id}:${user.id}`;
  const selectedId = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return memory.get(storageKey) || localStorage.getItem(storageKey);
      } catch {
        return memory.get(storageKey) || null;
      }
    },
    () => null,
  );
  const rows = useMemo(() => selectableBalances(balances), [balances]);
  const row = selectedBalance(rows, selectedId);
  const index = rows.findIndex((item) => String(item.id) === String(row?.id));
  const choose = useCallback(
    (nextRow, nextDirection) => {
      if (!nextRow || String(nextRow.id) === String(row?.id)) return;
      setDirection(nextDirection);
      setHasMoved(true);
      try {
        localStorage.setItem(storageKey, String(nextRow.id));
      } catch {
        /* Mode privat: pilihan disimpan dalam memori. */
      }
      memory.set(storageKey, String(nextRow.id));
      window.dispatchEvent(new Event("sitou:balance-selection"));
    },
    [row?.id, storageKey],
  );
  const move = useCallback(
    (step) => choose(adjacentBalance(rows, row?.id, step), step),
    [choose, row?.id, rows],
  );
  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);
  useEffect(() => {
    if (!cardRef.current || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setCardVisible(entry.isIntersecting));
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);
  const autoplaying = shouldAutoRotateBalance({
    count: rows.length,
    hovering,
    focusWithin,
    reducedMotion,
    pageVisible,
    cardVisible,
  });
  useEffect(() => {
    if (!autoplaying) return undefined;
    const timer = window.setInterval(() => move(1), 5000);
    return () => window.clearInterval(timer);
  }, [autoplaying, move]);
  const surfaceProps =
    rows.length > 1
      ? {
          onMouseEnter: () => setHovering(true),
          onMouseLeave: () => setHovering(false),
          onFocusCapture: (event) => {
            setFocusWithin(event.target.matches(":focus-visible"));
          },
          onBlurCapture: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
          },
        }
      : undefined;
  const interactionProps =
    rows.length > 1
      ? {
          role: "group",
          tabIndex: 0,
          "aria-roledescription": "kartu geser",
          "aria-label": `Jenis cuti dan izin ${index + 1} dari ${rows.length}. Geser atau tekan tombol panah kiri dan kanan.`,
          onPointerDown: (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.pointerType === "mouse")
              event.currentTarget.setPointerCapture(event.pointerId);
            pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          },
          onPointerUp: (event) => {
            const start = pointer.current;
            pointer.current = null;
            if (!start || start.id !== event.pointerId) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) move(dx < 0 ? 1 : -1);
          },
          onPointerCancel: () => {
            pointer.current = null;
          },
          onKeyDown: (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              move(event.key === "ArrowRight" ? 1 : -1);
            }
          },
        }
      : undefined;
  return (
    <DashboardMetric
      refined
      metric={leaveBalanceCardMetric(row)}
      surfaceRef={cardRef}
      surfaceProps={surfaceProps}
      slide={
        rows.length > 1
          ? { key: String(row.id), direction, animate: hasMoved, autoplaying, interactionProps }
          : undefined
      }
      navigation={
        rows.length > 1 ? (
          <Box
            role="group"
            aria-label="Pilih jenis cuti dan izin"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              columnGap: 0.25,
              transform: "translateY(8px)",
            }}
          >
            {rows.map((item, itemIndex) => (
              <IconButton
                key={item.id}
                size="small"
                aria-label={`Tampilkan ${item.name}, ${itemIndex + 1} dari ${rows.length}`}
                aria-current={itemIndex === index ? "true" : undefined}
                onClick={() => choose(item, itemIndex >= index ? 1 : -1)}
                sx={{ width: 28, height: 28, p: 0 }}
              >
                <Box
                  sx={{
                    width: itemIndex === index ? 9 : 7,
                    height: itemIndex === index ? 9 : 7,
                    borderRadius: "50%",
                    bgcolor:
                      itemIndex === index
                        ? theme.palette.primary.main
                        : theme.status.neutral.border,
                  }}
                />
              </IconButton>
            ))}
          </Box>
        ) : null
      }
    />
  );
}
