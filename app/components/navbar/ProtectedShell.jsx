"use client";

import { accessChangeImpact, pageAccessState } from "@/lib/access/liveAccessPolicy.mjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import Notification from "../Notifications/Notification";
import { useLoadingBackdrop } from "../loading/LoadingBackdropProvider";
import MENU_CONFIG from "../menu/MenuConfig";
import { getMenusByRole } from "../menu/getMenuByRole";
import LeftNavBar from "./LeftNavBar";
import MobileLeftNavBar from "./MobileLeftNavBar";
import TopMenu from "./TopMenu";
import SubscriptionBanner from "../subscription/SubscriptionBanner";
import ExpiredSessionModal from "../modals/ExpiredSessionModal";
import AccessChangedModal from "../modals/AccessChangedModal";
import { AuthenticatedUserProvider } from "../auth/AuthenticatedUserProvider";
import { waitForMinimumDuration } from "@/lib/ui/minimumDuration.mjs";

export default function ProtectedShell({ user, children }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { startLoading, startNavigationLoading, finishNavigationLoading } = useLoadingBackdrop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: "", severity: "error" });
  const [sessionExpired, setSessionExpired] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const [access, setAccess] = useState(user.access);
  const accessRef = useRef(user.access);
  const changeModeRef = useRef(null);
  const [accessChange, setAccessChange] = useState(null);
  const [accessCountdown, setAccessCountdown] = useState(5);
  const [contentRevision, setContentRevision] = useState(0);
  const menus = useMemo(
    () => getMenusByRole(MENU_CONFIG, user.role_code, access),
    [user.role_code, access],
  );
  useEffect(() => {
    const controller = new AbortController();
    let latestRequest = 0;
    let activeRequest = null;
    const refresh = async () => {
      activeRequest?.abort();
      const request = new AbortController();
      activeRequest = request;
      const requestNumber = ++latestRequest;
      try {
        const response = await fetch("/api/access/me", {
          cache: "no-store",
          signal: request.signal,
        });
        if (controller.signal.aborted || request.signal.aborted || requestNumber !== latestRequest)
          return;
        if (response.status === 401) {
          setSessionExpired(true);
          return;
        }
        if (!response.ok) return;
        const body = await response.json();
        if (controller.signal.aborted || request.signal.aborted || requestNumber !== latestRequest)
          return;
        const before = accessRef.current;
        const next = body.data;
        accessRef.current = next;
        setAccess(next);
        const impact = accessChangeImpact(user.role_code, pathname, before, next);
        const page = pageAccessState(user.role_code, next, pathname);
        if (impact) {
          changeModeRef.current = impact;
          setAccessChange(impact);
          setAccessCountdown(5);
          setDrawerOpen(false);
          setContentRevision((revision) => revision + 1);
        } else if (changeModeRef.current === "redirect" && page.canRead) {
          // Jika izin dipulihkan sebelum hitungan berakhir, jangan tetap mengalihkan pengguna.
          changeModeRef.current = null;
          setAccessChange(null);
          setContentRevision((revision) => revision + 1);
        } else if (!page.canRead && pathname !== "/dashboard" && !changeModeRef.current) {
          // Termasuk tautan lama yang dibuka setelah izin lebih dahulu dicabut.
          changeModeRef.current = "redirect";
          setAccessChange("redirect");
          setAccessCountdown(5);
          setDrawerOpen(false);
        }
      } catch (error) {
        // Kegagalan jaringan mempertahankan snapshot terakhir; jangan kembali ke izin role legacy.
        if (error.name === "AbortError") return;
      } finally {
        if (activeRequest === request) activeRequest = null;
      }
    };
    void refresh();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval =
      user.role_code === "superadmin" ? null : window.setInterval(refreshIfVisible, 8000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("sitou:access-changed", refresh);
    window.addEventListener("sitou:permission-denied", refresh);
    return () => {
      controller.abort();
      activeRequest?.abort();
      if (interval !== null) window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("sitou:access-changed", refresh);
      window.removeEventListener("sitou:permission-denied", refresh);
    };
  }, [pathname, router, user.role_code]);

  useEffect(() => {
    if (pathname === "/dashboard" && changeModeRef.current === "redirect") {
      changeModeRef.current = null;
      setAccessChange(null);
    }
  }, [pathname]);

  useEffect(() => {
    if (!accessChange || sessionExpired) return undefined;
    const interval = window.setInterval(
      () => setAccessCountdown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    const timeout = window.setTimeout(() => {
      if (accessChange === "redirect") router.replace("/dashboard");
      else {
        changeModeRef.current = null;
        setAccessChange(null);
      }
    }, 5000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [accessChange, router, sessionExpired]);

  useEffect(() => {
    finishNavigationLoading();
  }, [finishNavigationLoading, pathname]);

  useEffect(() => {
    const delay = Math.max(0, Number(user.session_expires_at) - Date.now());
    const timeout = window.setTimeout(() => setSessionExpired(true), delay);
    return () => window.clearTimeout(timeout);
  }, [user.session_expires_at]);

  useEffect(() => {
    if (!sessionExpired) return undefined;

    const interval = window.setInterval(() => {
      setRedirectCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    const redirect = window.setTimeout(async () => {
      startNavigationLoading({ message: "Membuka halaman login..." });
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      router.replace("/login");
    }, 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(redirect);
    };
  }, [router, sessionExpired, startNavigationLoading]);

  const navigate = (path) => {
    if (!path || path === pathname) return;
    // Form dapat menahan navigasi sidebar sampai perubahan belum tersimpan dikonfirmasi.
    if (
      !window.dispatchEvent(
        new CustomEvent("sitou:before-navigate", { cancelable: true, detail: { path } }),
      )
    )
      return;

    setDrawerOpen(false);
    startNavigationLoading({ message: "Membuka halaman..." });
    router.push(path);
  };

  const logout = async () => {
    const startedAt = Date.now();
    const finishLogout = startLoading({ message: "Keluar dari SITOU..." });

    try {
      const [response] = await Promise.all([
        fetch("/api/auth/logout", { method: "POST" }).catch(() => null),
        waitForMinimumDuration(startedAt),
      ]);
      if (!response?.ok) throw new Error("Logout gagal");

      startNavigationLoading({ message: "Membuka halaman login..." });
      router.replace("/login");
    } catch {
      finishNavigationLoading();
      setNotification({
        open: true,
        message: "Gagal keluar dari sistem. Silakan coba kembali.",
        severity: "error",
      });
    } finally {
      finishLogout();
    }
  };

  const redirectToLogin = async () => {
    startNavigationLoading({ message: "Membuka halaman login..." });
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
  };

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100dvh",
        display: "flex",
        overflowX: "clip",
        bgcolor: theme.ui.pageBg,
      }}
    >
      <Box
        sx={{
          display: { xs: "none", lg: "block" },
          width: 280,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: "fixed",
            inset: "0 auto 0 0",
            width: 280,
            height: "100dvh",
            overflow: "hidden",
            zIndex: theme.zIndex.appBar,
          }}
        >
          <LeftNavBar menus={menus} user={user} onNavigate={navigate} />
        </Box>
      </Box>

      <MobileLeftNavBar
        menus={menus}
        user={user}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={navigate}
      />

      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          flex: 1,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflowX: "clip",
        }}
      >
        <TopMenu
          user={user}
          onBurgerClick={() => setDrawerOpen(true)}
          onProfile={() => navigate("/profile")}
          onLogout={logout}
        />
        <Box
          component="main"
          sx={{
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            flex: 1,
            overflowX: "hidden",
            p: { xs: 2, sm: 3, lg: 4 },
          }}
        >
          <Box sx={{ mb: user.organization_subscription_ends_on ? 3 : 0 }}>
            <SubscriptionBanner
              status={user.organization_subscription_status}
              endsOn={user.organization_subscription_ends_on}
              graceEndsOn={user.organization_subscription_grace_ends_on}
              daysRemaining={user.organization_days_remaining}
              onRenew={() =>
                setNotification({
                  open: true,
                  message:
                    "Permintaan perpanjangan akan tersedia pada tahap pengembangan berikutnya.",
                  severity: "info",
                })
              }
            />
          </Box>
          <AuthenticatedUserProvider key={contentRevision} user={{ ...user, access }}>
            {accessChange === "redirect" ||
            !pageAccessState(user.role_code, access, pathname).canRead
              ? null
              : children}
          </AuthenticatedUserProvider>
        </Box>
      </Box>

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification((current) => ({ ...current, open: false }))}
      />
      <ExpiredSessionModal
        open={sessionExpired}
        secondsRemaining={redirectCountdown}
        onLogout={redirectToLogin}
      />
      <AccessChangedModal
        mode={sessionExpired ? null : accessChange}
        secondsRemaining={accessCountdown}
        onContinue={() => {
          if (accessChange === "redirect") router.replace("/dashboard");
          else {
            changeModeRef.current = null;
            setAccessChange(null);
          }
        }}
      />
    </Box>
  );
}
