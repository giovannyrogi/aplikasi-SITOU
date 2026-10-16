"use client";

import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Box, Button, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import AppIcon from "@/app/components/icons/AppIcon";
import FontStyle from "@/app/components/font-style/FontStyle";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import ActorIdentity from "@/app/components/data-display/ActorIdentity";
import EmptyState from "@/app/components/data-display/EmptyState";
import { KindMark } from "@/app/components/inventory/TransactionPresentationParts";
import { transactionPresentations } from "@/app/components/inventory/transactionPresentations";
import { inventoryActorPhotoUrl } from "@/lib/identity/actorPresentation.mjs";
import TransactionDetailModal from "@/app/components/inventory/TransactionDetailModal";
import Notification from "@/app/components/Notifications/Notification";
import useAppNotification from "@/app/hooks/useAppNotification";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import { readApiResponse, normalizeRequestError } from "@/lib/api/clientError";

function RecentTransactionCard({ transaction, organizationId, onOpen, opening }) {
  const theme = useTheme();
  const mobile = useMediaQuery("(max-width:767px)");
  const entry = transactionPresentations[transaction.kind];
  // Mengikuti legenda aktivitas dan ringkasan jenis transaksi pada Dashboard.
  const tone =
    transaction.kind === "return"
      ? "info"
      : transaction.kind === "stocktake"
        ? "secondary"
        : entry?.tone || "info";
  const accent = transaction.cancelled
    ? theme.status.danger.main
    : tone === "secondary"
      ? theme.palette.secondary.main
      : theme.status[tone].main;
  const date = dayjs(transaction.occurred_on).format("D MMM YYYY");
  return (
    <Box
      component="article"
      aria-label={`${entry?.label || "Transaksi barang"} · ${date}`}
      sx={{
        p: { xs: 2, sm: 2.5 },
        minWidth: 0,
        display: "grid",
        alignItems: "center",
        gridTemplateColumns: {
          xs: "minmax(0,1fr)",
          md: "minmax(0,1fr) minmax(0,1fr)",
          lg: "minmax(0,1.2fr) minmax(0,1.45fr) minmax(0,1.1fr) auto",
        },
        gap: { xs: 2, lg: 3 },
        bgcolor: theme.ui.panelBg,
        border: "1px solid",
        borderColor: theme.ui.panelBorderSubtle,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 2.5,
        boxShadow: theme.ui.panelShadow,
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover, &:focus-within": {
          transform: "translateY(-2px)",
          boxShadow: theme.ui.dashboardCardHoverShadow,
          borderColor: theme.ui.panelBorder,
          borderLeftColor: accent,
        },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover, &:focus-within": { transform: "none" },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}>
        <KindMark kind={transaction.kind} tone={tone} />
        <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
          <FontStyle
            component="h3"
            fontSize={14}
            fontWeight={700}
            sx={{ overflowWrap: "anywhere" }}
          >
            {entry?.label || "Transaksi barang"}
          </FontStyle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <CompactInfoChip
              label={transaction.cancelled ? "Dibatalkan" : "Tersimpan"}
              tone={transaction.cancelled ? "danger" : "success"}
            />
            <FontStyle fontSize={12} fontWeight={600} sx={{ color: "text.secondary" }}>
              {transaction.item_count} jenis barang
            </FontStyle>
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "minmax(0,0.85fr) minmax(0,1.15fr)" },
          gap: 2,
          minWidth: 0,
        }}
      >
        {[
          { label: "Tanggal transaksi", value: date },
          { label: "Gudang", value: transaction.warehouse_name },
        ].map((field) => (
          <Box key={field.label} sx={{ minWidth: 0 }}>
            <FontStyle fontSize={11.5} sx={{ color: "text.secondary", mb: 0.5 }}>
              {field.label}
            </FontStyle>
            <FontStyle fontSize={13} fontWeight={600} sx={{ overflowWrap: "anywhere" }}>
              {field.value || "Tidak tersedia"}
            </FontStyle>
          </Box>
        ))}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <FontStyle fontSize={11.5} sx={{ color: "text.secondary", mb: 1 }}>
          Disimpan oleh
        </FontStyle>
        <ActorIdentity
          name={transaction.actor_name}
          position={transaction.actor_position_name}
          photoUrl={inventoryActorPhotoUrl(
            transaction.actor_photo_file_id,
            organizationId,
            transaction.id,
          )}
        />
      </Box>
      <Box
        sx={{
          minWidth: 0,
          borderTop: { xs: `1px solid ${theme.ui.panelBorderSubtle}`, lg: "none" },
          pt: { xs: 2, lg: 0 },
        }}
      >
        <Tooltip title="Lihat detail transaksi">
          <Box component="span" sx={{ display: "block", width: mobile ? "100%" : 44, ml: "auto" }}>
            <Button
              onClick={() => onOpen(transaction)}
              disabled={opening}
              variant="outlined"
              startIcon={mobile ? <AppIcon icon="solar:eye-linear" width={18} /> : undefined}
              aria-label={`Lihat detail ${entry?.label || "transaksi"} ${date}`}
              aria-haspopup="dialog"
              sx={{
                minHeight: 44,
                minWidth: 44,
                width: mobile ? "100%" : 44,
                px: mobile ? 2 : 0,
                textTransform: "none",
                whiteSpace: "nowrap",
                borderRadius: 1.5,
                bgcolor: theme.ui.panelAccentBg,
              }}
            >
              {mobile ? "Lihat detail" : <AppIcon icon="solar:eye-linear" width={20} />}
            </Button>
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
}

/** Daftar transaksi resmi dengan identitas, status, serta metadata yang terpisah jelas. */
export default function RecentInventoryTransactions({ transactions, organizationId }) {
  const [detail, setDetail] = useState(null);
  const [opening, setOpening] = useState(false);
  const requestRef = useRef(null);
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const { notification, showNotification, closeNotification } = useAppNotification();
  useEffect(() => () => requestRef.current?.abort(), []);
  const openDetail = async (transaction) => {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setOpening(true);
    try {
      const body = await runWithLoadingBackdrop(
        () =>
          fetch(
            `/api/inventory/transactions/${encodeURIComponent(transaction.id)}?organizationId=${encodeURIComponent(organizationId)}`,
            { cache: "no-store", signal: request.signal },
          ).then(readApiResponse),
        { message: "Membuka rincian transaksi..." },
      );
      if (!request.signal.aborted) setDetail(body.data);
    } catch (error) {
      if (!request.signal.aborted) showNotification(normalizeRequestError(error).message, "error");
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        if (!request.signal.aborted) setOpening(false);
      }
    }
  };
  if (!transactions.length) return <EmptyState description="Belum ada transaksi." />;
  return (
    <>
      <Box
        component="ol"
        aria-label="Daftar transaksi terbaru"
        sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 2, minWidth: 0 }}
      >
        {transactions.map((transaction) => (
          <Box component="li" key={transaction.id} sx={{ minWidth: 0 }}>
            <RecentTransactionCard
              transaction={transaction}
              organizationId={organizationId}
              onOpen={openDetail}
              opening={opening}
            />
          </Box>
        ))}
      </Box>
      {detail ? (
        <TransactionDetailModal
          detail={detail}
          organizationId={organizationId}
          onClose={() => setDetail(null)}
        />
      ) : null}
      <Notification {...notification} onClose={closeNotification} />
    </>
  );
}
