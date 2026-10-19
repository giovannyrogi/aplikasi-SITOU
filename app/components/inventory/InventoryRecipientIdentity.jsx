"use client";
import ActorIdentity from "@/app/components/data-display/ActorIdentity";
import { inventoryActorPhotoUrl } from "@/lib/identity/actorPresentation.mjs";

/** Pas foto dibatasi dokumen atau pilihan penerima yang divalidasi ulang oleh server. */
export default function InventoryRecipientIdentity({
  recipient,
  organizationId,
  transactionId,
  view = "transaction",
  selection,
}) {
  const fileId = recipient?.recipient_photo_file_id;
  let photoUrl = inventoryActorPhotoUrl(fileId, organizationId, transactionId, view, "recipient");
  if (selection && fileId) {
    const query = new URLSearchParams({
      organizationId: String(organizationId),
      inventoryActorTransactionId: selection.transactionId,
      inventoryActorRole: "recipient-selection",
      warehouseId: String(selection.warehouseId),
      locationId: String(selection.destinationLocationId),
      unitId: String(selection.destinationUnitId),
      occurredOn: selection.occurredOn,
    });
    photoUrl = `/api/uploads/${encodeURIComponent(fileId)}?${query}`;
  }
  return (
    <ActorIdentity
      name={recipient?.recipient_name || recipient?.full_name || "Tidak tersedia"}
      position={recipient?.recipient_position_name}
      photoUrl={photoUrl}
    />
  );
}
