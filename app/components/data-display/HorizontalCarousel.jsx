"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Box, IconButton, Tooltip, useMediaQuery } from "@mui/material";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import FontStyle from "../font-style/FontStyle";

/** Daftar horizontal; rotasi hanya ketika meluap dan pengguna tidak sedang membacanya. */
export default function HorizontalCarousel({ items, getKey, renderItem, label, paused = false }) {
  const id = useId();
  const viewport = useRef(null);
  const interacting = useRef({ hover: false, focus: false, pointer: false });
  const visible = useRef(true);
  const backwardsWrap = useRef(false);
  const resumeAfter = useRef(0);
  const [layout, setLayout] = useState({ overflow: false, step: 0, cycle: 0 });
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const element = viewport.current;
    const measure = () => {
      const first = element.children[0];
      if (!first) return;
      const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
      const step = first.getBoundingClientRect().width + gap;
      const cycle = step * items.length;
      const overflow = cycle - gap > element.clientWidth + 1;
      setLayout((current) =>
        current.overflow === overflow && current.step === step && current.cycle === cycle
          ? current
          : { overflow, step, cycle },
      );
    };
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    measure();
    const intersection = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    intersection.observe(element);
    return () => {
      resize.disconnect();
      intersection.disconnect();
    };
  }, [items.length]);

  useEffect(() => {
    const element = viewport.current;
    element.scrollTo({ left: 0, behavior: "instant" });
  }, [items]);

  useEffect(() => {
    const element = viewport.current;
    if (!layout.overflow) return;
    let settle;
    const normalize = () => {
      if (backwardsWrap.current) return;
      if (element.scrollLeft >= layout.cycle - 1)
        element.scrollTo({
          left: Math.max(0, element.scrollLeft - layout.cycle),
          behavior: "instant",
        });
    };
    const scrolled = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        backwardsWrap.current = false;
        normalize();
      }, 160);
    };
    element.addEventListener("scroll", scrolled, { passive: true });
    element.addEventListener("scrollend", normalize);
    return () => {
      clearTimeout(settle);
      element.removeEventListener("scroll", scrolled);
      element.removeEventListener("scrollend", normalize);
    };
  }, [layout]);

  useEffect(() => {
    if (!layout.overflow || reducedMotion || paused) return;
    const timer = setInterval(() => {
      if (
        document.hidden ||
        !visible.current ||
        Date.now() < resumeAfter.current ||
        Object.values(interacting.current).some(Boolean)
      )
        return;
      viewport.current.scrollBy({ left: layout.step, behavior: "smooth" });
    }, 4500);
    return () => clearInterval(timer);
  }, [layout, reducedMotion, paused]);

  const move = (direction) => {
    const element = viewport.current;
    resumeAfter.current = Date.now() + 9000;
    if (direction < 0 && element.scrollLeft < 1) {
      backwardsWrap.current = true;
      element.scrollTo({ left: layout.cycle, behavior: "instant" });
    }
    element.scrollBy({
      left: direction * layout.step,
      behavior: reducedMotion ? "instant" : "smooth",
    });
  };
  const item = (entry, index, clone) => (
    <Box
      key={`${clone ? "clone" : "item"}:${getKey(entry)}`}
      aria-hidden={clone || undefined}
      role={clone ? undefined : "group"}
      aria-label={clone ? undefined : `${index + 1} dari ${items.length}`}
      sx={{
        minWidth: 0,
        display: "flex",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        "& > *": { width: "100%" },
      }}
    >
      {renderItem(entry, { isClone: clone })}
    </Box>
  );

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        id={id}
        ref={viewport}
        role="region"
        aria-label={label}
        aria-roledescription="karusel"
        tabIndex={0}
        onMouseEnter={() => {
          interacting.current.hover = true;
        }}
        onMouseLeave={() => {
          interacting.current.hover = false;
        }}
        onFocusCapture={() => {
          interacting.current.focus = true;
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) interacting.current.focus = false;
        }}
        onPointerDown={() => {
          interacting.current.pointer = true;
          resumeAfter.current = Date.now() + 9000;
        }}
        onPointerUp={() => {
          interacting.current.pointer = false;
        }}
        onPointerCancel={() => {
          interacting.current.pointer = false;
        }}
        onWheel={() => {
          resumeAfter.current = Date.now() + 9000;
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        sx={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: { xs: "100%", sm: "240px" },
          gap: 2,
          overflowX: "auto",
          overscrollBehaviorX: "contain",
          scrollSnapType: "x mandatory",
          scrollPaddingInline: "4px",
          py: 1,
          px: 0.5,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
            borderRadius: 2,
          },
        }}
      >
        {items.map((entry, index) => item(entry, index, false))}
        {layout.overflow ? items.map((entry, index) => item(entry, index, true)) : null}
      </Box>
      {layout.overflow ? (
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
          <FontStyle fontSize={11.5} sx={{ color: "text.secondary", mr: "auto" }}>
            {items.length} barang
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              {" "}
              · Geser untuk melihat
            </Box>
          </FontStyle>
          <Tooltip title="Barang sebelumnya">
            <IconButton
              aria-label="Barang sebelumnya"
              aria-controls={id}
              onClick={() => move(-1)}
              sx={{ width: 44, height: 44 }}
            >
              <ChevronLeftRounded />
            </IconButton>
          </Tooltip>
          <Tooltip title="Barang berikutnya">
            <IconButton
              aria-label="Barang berikutnya"
              aria-controls={id}
              onClick={() => move(1)}
              sx={{ width: 44, height: 44 }}
            >
              <ChevronRightRounded />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}
    </Box>
  );
}
