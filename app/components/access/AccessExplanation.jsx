"use client";
import AppNotice from "@/app/components/data-display/AppNotice";

/** Kompatibilitas uraian akses; visual dan warna berasal dari AppNotice. */
export default function AccessExplanation({ children, title = "Kemampuan akses" }) {
  return (
    <AppNotice tone="info" title={title} compact sx={{ mt: 1 }}>
      {children}
    </AppNotice>
  );
}
