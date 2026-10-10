"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import useFormModalClose from "./useFormModalClose";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
/** Menunggu konfirmasi pembuangan isian sebelum membuka halaman prasyarat. */
export default function usePrerequisiteNavigation(form, onClose, isDirty) {
  const destination = useRef(null);
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();
  const close = useFormModalClose(
    form,
    () => {
      onClose();
      if (destination.current) {
        const href = destination.current;
        destination.current = null;
        startNavigationLoading({ message: "Membuka data prasyarat..." });
        router.push(href);
      }
    },
    isDirty,
  );
  return {
    close: {
      ...close,
      keepEditing: () => {
        destination.current = null;
        close.keepEditing();
      },
    },
    navigate: (href) => {
      destination.current = href;
      close.requestClose();
    },
  };
}
