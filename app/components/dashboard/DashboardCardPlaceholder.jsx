"use client";

import { Box, Paper, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";

const heights = {
  metric: 168,
  area: 390,
  horizontal: 390,
  stacked: 390,
  list: 280,
  birthday: 240,
  composition: 430,
  retirement: 390,
};

function Line({ width = "70%", height = 12 }) {
  const theme = useTheme();
  return <Box sx={{ width, height, borderRadius: 1, bgcolor: theme.ui.mutedText }} />;
}

function Rows({ count = 4, avatar = false }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {Array.from({ length: count }, (_, index) => (
        <Box key={index} sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {avatar ? (
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                bgcolor: alpha(theme.palette.primary.main, 0.4),
                flexShrink: 0,
              }}
            />
          ) : null}
          <Box sx={{ flex: 1, display: "grid", gap: 0.75 }}>
            <Line width={`${62 + (index % 3) * 11}%`} />
            <Line width={`${35 + (index % 2) * 17}%`} height={8} />
          </Box>
          <Line width="13%" height={10} />
        </Box>
      ))}
    </Box>
  );
}

/** Semua bentuk adalah geometri tetap; tidak memakai nilai atau identitas dari respons server. */
function SyntheticContent({ kind }) {
  const theme = useTheme();
  const accent = alpha(theme.palette.primary.main, 0.42);
  const soft = alpha(theme.palette.primary.main, 0.2);
  if (kind === "metric")
    return (
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Line width="32%" height={28} />
        <Box sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: soft }} />
      </Box>
    );
  if (kind === "birthday") return <Rows count={3} avatar />;
  if (kind === "list") return <Rows count={4} />;
  if (kind === "retirement")
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Line width="22%" height={26} />
          <Line width="22%" height={26} />
        </Box>
        <Rows count={4} />
      </Box>
    );
  if (kind === "composition")
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
        {[0, 1, 2, 3].map((index) => (
          <Box
            key={index}
            sx={{
              border: `1px solid ${theme.ui.dashboardCardBorder}`,
              p: 1.5,
              minHeight: 136,
              display: "grid",
              justifyItems: "center",
              gap: 1,
            }}
          >
            <Line width="65%" height={10} />
            {index === 0 ? (
              <Box
                sx={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  border: `14px solid ${soft}`,
                  borderTopColor: accent,
                  borderRightColor: accent,
                }}
              />
            ) : index === 1 ? (
              <Box sx={{ width: "90%", display: "flex", pt: 3 }}>
                <Box sx={{ width: "62%", height: 27, bgcolor: accent }} />
                <Box sx={{ width: "38%", height: 27, bgcolor: soft }} />
              </Box>
            ) : (
              <Box sx={{ width: "90%", display: "grid", gap: 1, pt: 1 }}>
                {[72, 49, 86].map((width, barIndex) => (
                  <Box
                    key={barIndex}
                    sx={{ width: `${width}%`, height: 13, borderRadius: 1, bgcolor: accent }}
                  />
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  if (kind === "horizontal")
    return (
      <Box sx={{ display: "grid", gap: 1.75, pt: 1 }}>
        {[72, 93, 57, 81, 45].map((width, index) => (
          <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Line width="19%" height={10} />
            <Box sx={{ width: `${width * 0.78}%`, height: 22, borderRadius: 1, bgcolor: accent }} />
          </Box>
        ))}
      </Box>
    );
  if (kind === "stacked")
    return (
      <Box sx={{ display: "flex", alignItems: "end", gap: 1, height: 220, pt: 2 }}>
        {[63, 83, 57, 75, 49, 91, 68].map((height, index) => (
          <Box
            key={index}
            sx={{
              width: "14%",
              height: `${height}%`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "end",
              gap: "2px",
            }}
          >
            <Box sx={{ height: "38%", bgcolor: soft }} />
            <Box sx={{ height: "62%", bgcolor: accent }} />
          </Box>
        ))}
      </Box>
    );
  return (
    <Box sx={{ height: 220, pt: 1 }}>
      <svg
        viewBox="0 0 600 210"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <path
          d="M0 180 L80 150 L160 163 L240 110 L320 126 L400 77 L480 98 L600 38 L600 210 L0 210 Z"
          fill={soft}
        />
        <path
          d="M0 180 L80 150 L160 163 L240 110 L320 126 L400 77 L480 98 L600 38"
          fill="none"
          stroke={accent}
          strokeWidth="6"
        />
        <path
          d="M0 190 L100 168 L200 177 L300 145 L400 154 L500 109 L600 121"
          fill="none"
          stroke={accent}
          strokeWidth="4"
          strokeDasharray="8 5"
        />
      </svg>
    </Box>
  );
}

/** Siluet sesuai jenis kartu, selalu sintetis dan tersembunyi dari pembaca layar. */
export default function DashboardCardPlaceholder({ title, kind = "area", locked = true }) {
  const theme = useTheme();
  return (
    <Paper
      component="section"
      elevation={0}
      aria-label={title}
      data-dashboard-locked={locked ? "true" : undefined}
      data-dashboard-shape={kind}
      sx={{
        position: "relative",
        minWidth: 0,
        minHeight: heights[kind] || heights.area,
        overflow: "hidden",
        border: `1px solid ${theme.ui.dashboardCardBorder}`,
        borderRadius: "8px",
        bgcolor: theme.ui.dashboardCardBg,
        boxShadow: theme.ui.dashboardCardShadow,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{ p: { xs: 2, sm: 2.5 }, filter: "blur(4px)", opacity: 0.8, display: "grid", gap: 2 }}
      >
        <Line width="42%" height={15} />
        {kind !== "metric" ? <Line width="72%" /> : null}
        <SyntheticContent kind={kind} />
      </Box>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          p: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.62),
          textAlign: "center",
        }}
      >
        <Box sx={{ maxWidth: 330, display: "grid", justifyItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: theme.status.warning.background,
              color: theme.status.warning.main,
            }}
          >
            <AppIcon
              icon={locked ? "solar:lock-password-bold-duotone" : "solar:info-circle-bold"}
              width={21}
            />
          </Box>
          <FontStyle component="h2" fontSize={13} fontWeight={700}>
            {title}
          </FontStyle>
          <FontStyle fontSize={12} fontWeight={700} sx={{ color: theme.status.warning.main }}>
            {locked ? "Fitur terkunci" : "Data belum tersedia."}
          </FontStyle>
          {locked ? (
            <FontStyle fontSize={11.5} sx={{ color: theme.ui.mutedText }}>
              Anda tidak memiliki akses.
            </FontStyle>
          ) : null}
        </Box>
      </Box>
    </Paper>
  );
}
