"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function ProtectedShell({ user, children }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: "", severity: "error" });
  const [sessionExpired, setSessionExpired] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);
  const menus = useMemo(() => getMenusByRole(MENU_CONFIG, user.role_code), [user.role_code]);

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
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      router.replace("/login");
      router.refresh();
    }, 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(redirect);
    };
  }, [router, sessionExpired]);

  const navigate = async (path) => {
    if (!path || path === pathname) return;

    await runWithLoadingBackdrop(
      async () => {
        router.push(path);
      },
      { message: "Membuka halaman..." },
    );
  };

  const logout = async () => {
    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch("/api/auth/logout", { method: "POST" });
          if (!response.ok) throw new Error("Logout gagal");
          router.replace("/login");
          router.refresh();
        },
        { message: "Keluar dari SITOU..." },
      );
    } catch {
      setNotification({
        open: true,
        message: "Gagal keluar dari sistem. Silakan coba kembali.",
        severity: "error",
      });
    }
  };

  const redirectToLogin = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", bgcolor: theme.ui.pageBg }}>
      <Box sx={{ display: { xs: "none", lg: "block" }, width: 280, flexShrink: 0 }}>
        <LeftNavBar menus={menus} user={user} onNavigate={navigate} />
      </Box>

      <MobileLeftNavBar
        menus={menus}
        user={user}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={navigate}
      />

      <Box
        sx={{ minWidth: 0, flex: 1, minHeight: "100dvh", display: "flex", flexDirection: "column" }}
      >
        <TopMenu user={user} onBurgerClick={() => setDrawerOpen(true)} onLogout={logout} />
        <Box component="main" sx={{ minWidth: 0, flex: 1, p: { xs: 2, sm: 3, lg: 4 } }}>
          <Box sx={{ mb: user.organization_active_until ? 3 : 0 }}>
            <SubscriptionBanner
              activeUntil={user.organization_active_until}
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
          {children}
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
    </Box>
  );
}
