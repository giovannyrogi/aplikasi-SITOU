"use client";
import { Box } from "@mui/material";
import dayjs from "dayjs";
import InventoryMobileCardContent, {
  InventoryCardAction,
  InventoryCardIdentity,
} from "./InventoryMobileCardContent";
import { KindMark } from "./TransactionPresentationParts";
import { transactionPresentations } from "./transactionPresentations";
import CompactInfoChip from "@/app/components/chips/CompactInfoChip";
import FontStyle from "@/app/components/font-style/FontStyle";
import ActorIdentity from "@/app/components/data-display/ActorIdentity";
import { inventoryActorPhotoUrl } from "@/lib/identity/actorPresentation.mjs";
const amount = (value) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(Number(value));
/** Jenis, dokumen dan jumlah asli tetap terbaca; jumlah lintas barang/satuan tidak dijumlahkan. */
export default function InventoryTransactionCardContent({ row, organizationId, onDetail }) {
  const label = transactionPresentations[row.kind]?.label || "Transaksi barang";
  const lines = row.lines || [];
  return (
    <InventoryMobileCardContent
      identity={
        <InventoryCardIdentity icon={<KindMark kind={row.kind} size={48} />} title={label}>
          <CompactInfoChip
            label={row.cancelled ? "Dibatalkan" : "Tersimpan"}
            tone={row.cancelled ? "warning" : "success"}
          />
        </InventoryCardIdentity>
      }
      facts={[
        {
          label: "Tanggal transaksi",
          value: dayjs(row.occurred_on).format("D MMM YYYY"),
          fullWidth: true,
        },
        { label: "Gudang", value: row.warehouse_name, fullWidth: true },
        ...(row.reference_no
          ? [{ label: "Nomor referensi", value: row.reference_no, fullWidth: true }]
          : []),
      ]}
      quantityLabel="Barang dalam transaksi"
      quantities={lines.slice(0, 2).map((line, index) => ({
        key: line.itemId,
        label: line.name,
        stacked: true,
        separate: index > 0,
        value: (
          <Box
            component="span"
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 2,
              textAlign: "left",
            }}
          >
            <Box component="span" sx={{ minWidth: 0 }}>
              <FontStyle
                component="span"
                fontSize={12}
                sx={{ display: "block", color: "text.secondary", mb: 0.5 }}
              >
                Jumlah
              </FontStyle>
              <FontStyle
                component="span"
                fontSize={14}
                fontWeight={700}
                sx={{ display: "block", overflowWrap: "anywhere" }}
              >
                {amount(line.quantity)} {line.unit}
              </FontStyle>
            </Box>
            <Box component="span" sx={{ minWidth: 0 }}>
              <FontStyle
                component="span"
                fontSize={12}
                sx={{ display: "block", color: "text.secondary", mb: 0.5 }}
              >
                Perubahan stok
              </FontStyle>
              <FontStyle
                component="span"
                fontSize={14}
                fontWeight={700}
                sx={{ display: "block", overflowWrap: "anywhere" }}
              >
                {Number(line.delta) > 0 ? "+" : ""}
                {amount(line.delta)} {line.unit}
              </FontStyle>
            </Box>
          </Box>
        ),
      }))}
      quantityFooter={
        lines.length > 2 ? (
          <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
            {lines.length - 2} barang lainnya tersedia di detail transaksi.
          </FontStyle>
        ) : null
      }
      people={
        <Box>
          <FontStyle fontSize={12} sx={{ mb: 1, color: "text.secondary" }}>
            Disimpan oleh
          </FontStyle>
          <ActorIdentity
            position={row.actor_position_name}
            name={row.actor_name}
            photoUrl={inventoryActorPhotoUrl(row.actor_photo_file_id, organizationId, row.id)}
          />
        </Box>
      }
      action={
        <InventoryCardAction
          label="Lihat detail transaksi"
          ariaLabel={`Lihat detail ${label} tanggal ${dayjs(row.occurred_on).format("D MMM YYYY")}`}
          icon="solar:eye-linear"
          onClick={() => onDetail(row.id)}
        />
      }
    >
      {row.cancelled ? (
        <FontStyle fontSize={12} sx={{ color: "text.secondary" }}>
          Stok sudah dikembalikan. Jumlah transaksi asal tetap ditampilkan.
        </FontStyle>
      ) : null}
    </InventoryMobileCardContent>
  );
}
