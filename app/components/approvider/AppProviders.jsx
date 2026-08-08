"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import moment from "moment";
import "moment/locale/id";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterMoment } from "@mui/x-date-pickers/AdapterMoment";
import { ThemeModeProvider } from "../themeprovider/ThemeContext";
import ExpiredSessionModal from "../modals/ExpiredSessionModal";

moment.locale("id");

const SESSION_CHECK_INTERVAL = 1000;
const SESSION_MODAL_COUNTDOWN = 10;
const SESSION_EXPIRY_STORAGE_KEY = "sewain:session-expires-at";

const getCookie = (name) => {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(^| )${name}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[2]) : null;
};

const clearClientSession = () => {
  document.cookie =
    "loggedInUser=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict";
  sessionStorage.removeItem(SESSION_EXPIRY_STORAGE_KEY);
};

export default function AppProviders({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [counter, setCounter] = useState(SESSION_MODAL_COUNTDOWN);

  const isLoginPage = pathname === "/login";
  const isPublicPage =
    isLoginPage ||
    pathname === "/verify/izin-lahan" ||
    pathname?.startsWith("/verify/izin-lahan/");

  const openExpiredSessionModal = () => {
    setShowModal((alreadyOpen) => {
      if (!alreadyOpen) {
        setCounter(SESSION_MODAL_COUNTDOWN);
      }
      return true;
    });
  };

  /**
   * Pemeriksaan ini berjalan di client agar user yang membiarkan halaman terbuka
   * tetap mendapat modal expired session. Backend tetap menjadi sumber keamanan:
   * API menolak request setelah `expiresAt`, sedangkan client hanya mengatur UX.
   */
  useEffect(() => {
    if (isPublicPage) {
      sessionStorage.removeItem(SESSION_EXPIRY_STORAGE_KEY);
      setShowModal(false);
      return undefined;
    }

    const checkSession = () => {
      const cookie = getCookie("loggedInUser");
      const storedExpiresAt = Number(
        sessionStorage.getItem(SESSION_EXPIRY_STORAGE_KEY),
      );
      const now = Date.now();

      if (!cookie) {
        if (storedExpiresAt && storedExpiresAt <= now) {
          openExpiredSessionModal();
        }
        return;
      }

      try {
        const user = JSON.parse(cookie);
        const expiresAt = Number(user?.expiresAt);

        if (!expiresAt) return;

        sessionStorage.setItem(
          SESSION_EXPIRY_STORAGE_KEY,
          String(expiresAt),
        );

        if (expiresAt <= now) {
          openExpiredSessionModal();
        }
      } catch (error) {
        console.error("Gagal membaca cookie session:", error);
        openExpiredSessionModal();
      }
    };

    checkSession();
    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [isPublicPage]);

  useEffect(() => {
    if (!showModal) return undefined;

    if (counter <= 0) {
      clearClientSession();
      setShowModal(false);
      router.replace("/login");
      return undefined;
    }

    const timer = setTimeout(() => {
      setCounter((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showModal, counter, router]);

  return (
    <ThemeModeProvider>
      <LocalizationProvider dateAdapter={AdapterMoment} adapterLocale="id">
        {children}
        <ExpiredSessionModal open={showModal} counter={counter} />
      </LocalizationProvider>
    </ThemeModeProvider>
  );
}
