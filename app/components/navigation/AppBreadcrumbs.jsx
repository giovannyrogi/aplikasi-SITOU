"use client";

import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Box, Breadcrumbs, Link, useTheme } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import FontStyle from "../font-style/FontStyle";
import { useLoadingBackdrop } from "../loading/LoadingBackdropProvider";
import MENU_CONFIG from "../menu/MenuConfig";
import { resolveMenuBreadcrumbs } from "./resolveMenuBreadcrumbs.mjs";

/** Mengubah item menu menjadi data breadcrumb yang aman digunakan komponen presentasi. */
function mapMenuBreadcrumbs(items) {
  return items.map(({ label, value, icon, path }) => ({ label, value, icon, path }));
}

/** Menampilkan breadcrumb dinamis dari konfigurasi menu dengan navigasi loading terpusat. */
export default function AppBreadcrumbs({ items, menuList = MENU_CONFIG, fallbackLabel }) {
  const theme = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();
  const resolvedItems = items?.length
    ? items
    : mapMenuBreadcrumbs(resolveMenuBreadcrumbs(menuList, pathname));
  const breadcrumbs = resolvedItems.length
    ? resolvedItems
    : [{ label: fallbackLabel || "Halaman", value: "current-page" }];

  /** Memulai lifecycle loading sebelum perpindahan route melalui breadcrumb. */
  const navigate = (event, path) => {
    event.preventDefault();
    if (!path || path === pathname) return;
    startNavigationLoading({ message: "Membuka halaman..." });
    router.push(path);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        minHeight: 28,
        maxWidth: "100%",
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      <Breadcrumbs
        aria-label="Breadcrumb halaman"
        separator={<NavigateNextIcon sx={{ fontSize: 15, color: theme.ui.mutedText }} />}
        sx={{
          minWidth: "max-content",
          "& .MuiBreadcrumbs-ol": { alignItems: "center", flexWrap: "nowrap" },
          "& .MuiBreadcrumbs-li": { display: "inline-flex", alignItems: "center" },
          "& .MuiBreadcrumbs-separator": { mx: 1 },
        }}
      >
        {breadcrumbs.map((item, index) => {
          const isCurrent = index === breadcrumbs.length - 1;
          const key = item.value || item.path || `${item.label}-${index}`;
          const content = (
            <>
              {item.icon ? (
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    "& svg": { width: 14, height: 14, fontSize: "14px !important" },
                  }}
                >
                  {item.icon}
                </Box>
              ) : null}
              {item.label}
            </>
          );

          if (isCurrent) {
            return (
              <FontStyle
                key={key}
                component="span"
                fontSize={11.5}
                fontWeight={700}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: theme.palette.primary.main,
                  whiteSpace: "nowrap",
                }}
              >
                {content}
              </FontStyle>
            );
          }

          if (!item.path) {
            return (
              <FontStyle
                key={key}
                component="span"
                fontSize={11.5}
                fontWeight={600}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  color: theme.ui.mutedText,
                }}
              >
                {content}
              </FontStyle>
            );
          }

          return (
            <Link
              key={key}
              href={item.path}
              onClick={(event) => navigate(event, item.path)}
              underline="none"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minHeight: 28,
                color: theme.ui.mutedText,
                borderRadius: 1,
                fontFamily: "Poppins, sans-serif",
                fontSize: 11.5,
                fontWeight: 600,
                "&:hover": { color: theme.palette.primary.main },
                "&:focus-visible": {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              {content}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}
