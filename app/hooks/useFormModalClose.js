"use client";

import { useCallback, useState } from "react";

export default function useFormModalClose(form, onClose) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const requestClose = useCallback(() => {
    if (form.isFieldsTouched()) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  }, [form, onClose]);

  const discardChanges = useCallback(() => {
    setConfirmCloseOpen(false);
    form.resetFields();
    onClose();
  }, [form, onClose]);

  return {
    confirmCloseOpen,
    requestClose,
    keepEditing: () => setConfirmCloseOpen(false),
    discardChanges,
  };
}
