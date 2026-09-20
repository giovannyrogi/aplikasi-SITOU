"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Skeleton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CakeRoundedIcon from "@mui/icons-material/CakeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { useRouter } from "next/navigation";
import AppModal from "@/app/components/modals/AppModal";
import EmployeeAvatar from "@/app/components/employees/EmployeeAvatar";
import ImagePreviewModal from "@/app/components/modals/ImagePreviewModal";
import FontStyle from "@/app/components/font-style/FontStyle";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

const birthdayDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function employeeForAvatar(item) {
  return {
    full_name: item.fullName,
    organization_id: item.organizationId,
    profile_photo_file_id: item.profilePhotoFileId,
  };
}

function formatBirthdayDate(value) {
  if (!value) return "Tanggal belum tersedia";
  return birthdayDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function CountdownBadge({ daysUntil }) {
  const theme = useTheme();
  const today = daysUntil === 0;

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 28,
        px: 1.15,
        borderRadius: 999,
        color: today ? theme.palette.primary.dark : "#9A4A0A",
        bgcolor: today ? alpha(theme.palette.primary.main, 0.1) : "#FFF3E7",
        border: `1px solid ${today ? alpha(theme.palette.primary.main, 0.24) : "#F3C79F"}`,
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {today ? "Hari ini" : `Dalam ${daysUntil} hari`}
    </Box>
  );
}

function MetaItem({ icon: IconComponent, children, strong = false }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.7,
        minWidth: 0,
        minHeight: 18,
      }}
    >
      <IconComponent
        aria-hidden="true"
        sx={{
          display: "block",
          flexShrink: 0,
          fontSize: 16,
          color: strong ? theme.palette.primary.main : "#7B8493",
        }}
      />
      <FontStyle
        component="span"
        fontSize={11.5}
        fontWeight={strong ? 700 : 500}
        noWrap
        sx={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 18,
          lineHeight: "18px",
          color: strong ? theme.palette.primary.dark : theme.palette.text.secondary,
        }}
      >
        {children}
      </FontStyle>
    </Box>
  );
}

function AvatarFrame({ item, size, onPreview }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: size + 8,
        height: size + 8,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        borderRadius: "50%",
        bgcolor: theme.palette.background.paper,
        border: `2px solid ${alpha(theme.palette.primary.main, 0.22)}`,
        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.13)}`,
      }}
    >
      <EmployeeAvatar employee={employeeForAvatar(item)} size={size} onPreview={onPreview} />
    </Box>
  );
}

function EmptyGroup() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        m: 1.5,
        px: 1.5,
        py: 1.75,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        borderRadius: 2,
        bgcolor: theme.ui.panelSubtleBg,
        color: theme.ui.mutedText,
      }}
    >
      <CalendarMonthRoundedIcon sx={{ fontSize: 21 }} />
      <FontStyle fontSize={12}>Tidak ada pegawai pada kelompok ini.</FontStyle>
    </Box>
  );
}

function BirthdayListGroup({ title, description, items, onPreview, onOpenEmployee }) {
  const theme = useTheme();

  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        overflow: "hidden",
        border: `1px solid ${theme.ui.panelBorderSubtle}`,
        borderRadius: 2.5,
        bgcolor: theme.palette.background.paper,
      }}
    >
      <Box
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.035),
          borderBottom: items.length ? `1px solid ${theme.ui.panelBorderSubtle}` : 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <FontStyle component="h3" fontSize={14} fontWeight={700}>
            {title}
          </FontStyle>
          <FontStyle fontSize={11.5} sx={{ mt: 0.25, color: theme.ui.mutedText }}>
            {description}
          </FontStyle>
        </Box>
        <Box
          aria-label={`${items.length} pegawai`}
          sx={{
            minWidth: 32,
            height: 32,
            px: 0.8,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            borderRadius: 999,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {items.length}
        </Box>
      </Box>

      {items.length ? (
        <Box sx={{ display: "grid" }}>
          {items.map((item, itemIndex) => (
            <Box
              key={`${item.employeeId}-${item.celebrationDate}`}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "58px minmax(0,1fr) 42px",
                  sm: "62px minmax(0,1fr) auto 44px",
                },
                gap: { xs: 1.25, sm: 1.5 },
                alignItems: "center",
                px: { xs: 1.5, sm: 2 },
                py: 1.5,
                borderTop: itemIndex === 0 ? 0 : `1px solid ${theme.ui.panelBorderSubtle}`,
                transition: "background-color 160ms ease",
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.025) },
              }}
            >
              <AvatarFrame item={item} size={50} onPreview={onPreview} />

              <Box sx={{ minWidth: 0 }}>
                <FontStyle fontSize={13} fontWeight={750} noWrap title={item.fullName}>
                  {item.fullName}
                </FontStyle>
                <Box sx={{ mt: 0.55, display: "grid", gap: 0.4 }}>
                  <MetaItem icon={WorkOutlineRoundedIcon}>
                    {item.positionName || "Jabatan belum ditentukan"}
                  </MetaItem>
                  <MetaItem icon={PlaceOutlinedIcon}>
                    {item.locationName || "Belum ditempatkan"}
                  </MetaItem>
                </Box>
                <Box
                  sx={{
                    mt: 0.85,
                    display: { xs: "flex", sm: "none" },
                    alignItems: "center",
                    gap: 0.75,
                    flexWrap: "wrap",
                  }}
                >
                  <CountdownBadge daysUntil={item.daysUntil} />
                  <FontStyle component="span" fontSize={11.25} sx={{ color: theme.ui.mutedText }}>
                    {formatBirthdayDate(item.celebrationDate)}
                  </FontStyle>
                </Box>
              </Box>

              <Box
                sx={{
                  display: { xs: "none", sm: "grid" },
                  justifyItems: "end",
                  gap: 0.55,
                  minWidth: 108,
                }}
              >
                <CountdownBadge daysUntil={item.daysUntil} />
                <FontStyle fontSize={11.25} sx={{ color: theme.ui.mutedText }}>
                  {formatBirthdayDate(item.celebrationDate)}
                </FontStyle>
              </Box>

              <Tooltip title="Lihat profil pegawai">
                <IconButton
                  aria-label={`Lihat profil ${item.fullName}`}
                  onClick={() => onOpenEmployee(item)}
                  sx={{
                    width: 40,
                    height: 40,
                    color: theme.palette.primary.main,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                  }}
                >
                  <VisibilityOutlinedIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      ) : (
        <EmptyGroup />
      )}
    </Box>
  );
}

export default function BirthdaySpotlight({ data, loading }) {
  const theme = useTheme();
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const items = useMemo(() => data?.items || [], [data?.items]);
  const todayItems = useMemo(() => items.filter((item) => item.daysUntil === 0), [items]);
  const upcomingItems = useMemo(() => items.filter((item) => item.daysUntil > 0), [items]);
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (
      reduceMotion ||
      hovering ||
      focusWithin ||
      modalOpen ||
      !documentVisible ||
      items.length < 2
    ) {
      return undefined;
    }

    const interval = window.setInterval(
      () => setIndex((currentIndex) => (currentIndex + 1) % items.length),
      5000,
    );
    return () => window.clearInterval(interval);
  }, [documentVisible, focusWithin, hovering, items.length, modalOpen, reduceMotion]);

  const move = (direction) => {
    if (!items.length) return;
    setIndex((currentIndex) => (currentIndex + direction + items.length) % items.length);
  };

  const openEmployee = (item) => {
    startNavigationLoading({ message: "Membuka detail pegawai..." });
    router.push(
      `/employees/${encodeURIComponent(item.employeeId)}?organizationId=${encodeURIComponent(item.organizationId)}&tab=summary`,
    );
  };

  const current = items.length ? items[index % items.length] : null;

  return (
    <>
      <Paper
        component="section"
        aria-labelledby="birthday-spotlight-title"
        elevation={0}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocusCapture={() => setFocusWithin(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
        }}
        sx={{
          position: "relative",
          minHeight: { xs: 314, sm: 226 },
          overflow: "hidden",
          borderRadius: 2.5,
          border: `1px solid ${theme.ui.panelBorderSubtle}`,
          borderLeft: `4px solid ${theme.palette.primary.main}`,
          background: `linear-gradient(118deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.paper} 62%, ${alpha(theme.palette.primary.main, 0.045)} 100%)`,
          boxShadow: theme.ui.panelShadow,
          "@keyframes birthdaySlideUp": {
            from: { opacity: 0, transform: "translateY(14px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <CelebrationRoundedIcon
          aria-hidden="true"
          sx={{
            position: "absolute",
            right: { xs: -20, sm: 18 },
            bottom: { xs: -30, sm: -18 },
            fontSize: { xs: 116, sm: 148 },
            color: alpha(theme.palette.primary.main, 0.045),
            transform: "rotate(-12deg)",
            pointerEvents: "none",
          }}
        />

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            px: { xs: 2, sm: 2.5 },
            pt: { xs: 2, sm: 2.25 },
            pb: { xs: 1.5, sm: 1.75 },
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            borderBottom: `1px solid ${theme.ui.panelBorderSubtle}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            >
              <CakeRoundedIcon sx={{ fontSize: 23 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <FontStyle
                id="birthday-spotlight-title"
                component="h2"
                fontSize={{ xs: 14.5, sm: 15.5 }}
                fontWeight={750}
              >
                Ulang tahun pegawai
              </FontStyle>
              <FontStyle fontSize={11.5} sx={{ mt: 0.2, color: theme.ui.mutedText }}>
                {loading
                  ? "Memuat perayaan terdekat..."
                  : `Hari ini: ${data?.todayCount || 0} pegawai · 30 hari ke depan: ${data?.upcomingCount || 0} pegawai`}
              </FontStyle>
            </Box>
          </Box>

          <Tooltip title="Lihat seluruh daftar">
            <span>
              <IconButton
                aria-label="Lihat daftar ulang tahun"
                disabled={loading}
                onClick={() => setModalOpen(true)}
                sx={{
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  color: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                }}
              >
                <FormatListBulletedRoundedIcon sx={{ fontSize: 21 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            minHeight: { xs: 222, sm: 148 },
            px: { xs: 2, sm: 2.5 },
            py: { xs: 2, sm: 2.25 },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "minmax(0,1fr) auto" },
            gap: { xs: 2, sm: 3 },
            alignItems: "center",
          }}
        >
          {loading ? (
            <Box sx={{ display: "grid", gridTemplateColumns: "80px minmax(0,1fr)", gap: 2 }}>
              <Skeleton variant="circular" width={80} height={80} />
              <Box sx={{ pt: 0.5 }}>
                <Skeleton width="44%" height={24} />
                <Skeleton width="70%" />
                <Skeleton width="56%" />
                <Skeleton width="34%" />
              </Box>
            </Box>
          ) : current ? (
            <Box
              key={`${current.employeeId}-${current.celebrationDate}`}
              sx={{
                minWidth: 0,
                display: "grid",
                gridTemplateColumns: { xs: "80px minmax(0,1fr)", sm: "84px minmax(0,1fr)" },
                gap: { xs: 1.5, sm: 2 },
                alignItems: "center",
                animation: reduceMotion ? "none" : "birthdaySlideUp 380ms ease-out",
              }}
            >
              <AvatarFrame item={current} size={72} onPreview={setPhoto} />
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.85, flexWrap: "wrap" }}>
                  <FontStyle
                    fontSize={{ xs: 15.5, sm: 17 }}
                    fontWeight={750}
                    noWrap
                    title={current.fullName}
                  >
                    {current.preferredName || current.fullName}
                  </FontStyle>
                  <CountdownBadge daysUntil={current.daysUntil} />
                </Box>
                {current.preferredName && current.preferredName !== current.fullName ? (
                  <FontStyle fontSize={11.5} noWrap sx={{ mt: 0.25, color: theme.ui.mutedText }}>
                    {current.fullName}
                  </FontStyle>
                ) : null}
                <Box sx={{ mt: 0.75, display: "grid", gap: 0.48 }}>
                  <MetaItem icon={WorkOutlineRoundedIcon}>
                    {current.positionName || "Jabatan belum ditentukan"}
                  </MetaItem>
                  <MetaItem icon={PlaceOutlinedIcon}>
                    {current.locationName || "Belum ditempatkan"}
                  </MetaItem>
                  <MetaItem icon={CalendarMonthRoundedIcon} strong>
                    {formatBirthdayDate(current.celebrationDate)}
                  </MetaItem>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  borderRadius: "50%",
                  bgcolor: theme.ui.panelSubtleBg,
                  color: theme.ui.navIconColor,
                }}
              >
                <CalendarMonthRoundedIcon />
              </Box>
              <Box>
                <FontStyle fontSize={13.5} fontWeight={700}>
                  Belum ada perayaan terdekat
                </FontStyle>
                <FontStyle fontSize={11.5} sx={{ mt: 0.3, color: theme.ui.mutedText }}>
                  Tidak ada pegawai yang berulang tahun dalam 30 hari ke depan.
                </FontStyle>
              </Box>
            </Box>
          )}

          <Box
            sx={{
              justifySelf: { xs: "stretch", sm: "end" },
              alignSelf: { xs: "end", sm: "center" },
              display: "flex",
              alignItems: "center",
              justifyContent: { xs: "space-between", sm: "flex-end" },
              gap: 1,
              minWidth: { sm: 138 },
            }}
          >
            <FontStyle
              component="span"
              fontSize={11.5}
              fontWeight={700}
              sx={{ color: theme.ui.mutedText, fontVariantNumeric: "tabular-nums" }}
            >
              {items.length ? `${(index % items.length) + 1} / ${items.length}` : "0 / 0"}
            </FontStyle>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              <Tooltip title="Pegawai sebelumnya">
                <span>
                  <IconButton
                    aria-label="Pegawai ulang tahun sebelumnya"
                    disabled={items.length < 2}
                    onClick={() => move(-1)}
                    sx={{
                      width: 42,
                      height: 42,
                      bgcolor: theme.palette.background.paper,
                      border: `1px solid ${theme.ui.panelBorderSubtle}`,
                    }}
                  >
                    <ChevronLeftRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Pegawai berikutnya">
                <span>
                  <IconButton
                    aria-label="Pegawai ulang tahun berikutnya"
                    disabled={items.length < 2}
                    onClick={() => move(1)}
                    sx={{
                      width: 42,
                      height: 42,
                      bgcolor: theme.palette.background.paper,
                      border: `1px solid ${theme.ui.panelBorderSubtle}`,
                    }}
                  >
                    <ChevronRightRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Paper>

      <AppModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Daftar ulang tahun pegawai"
        description={`Menampilkan ulang tahun hari ini dan ${data?.windowDays || 30} hari ke depan. Tahun lahir disembunyikan.`}
        icon={<CakeRoundedIcon sx={{ fontSize: 23 }} />}
        size="lg"
        contentSx={{
          bgcolor: "#F8F9FB",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
        }}
        footer={<Button onClick={() => setModalOpen(false)}>Tutup</Button>}
      >
        <Box sx={{ display: "grid", gap: 2 }}>
          <BirthdayListGroup
            title="Ulang tahun hari ini"
            description="Pegawai yang berulang tahun hari ini."
            items={todayItems}
            onPreview={setPhoto}
            onOpenEmployee={openEmployee}
          />
          <BirthdayListGroup
            title="Akan datang dalam 30 hari"
            description="Diurutkan dari tanggal ulang tahun terdekat."
            items={upcomingItems}
            onPreview={setPhoto}
            onOpenEmployee={openEmployee}
          />
        </Box>
      </AppModal>

      <ImagePreviewModal
        open={Boolean(photo)}
        onClose={() => setPhoto(null)}
        imageUrl={photo?.imageUrl}
        alt={photo?.alt}
        title={photo?.title}
      />
    </>
  );
}
