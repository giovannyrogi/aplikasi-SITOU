"use client";

import { useCallback, useState } from "react";

export default function useFormModalClose(form, onClose, isDirty) {
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const requestClose = useCallback(() => {
    if (isDirty ? isDirty() : form.isFieldsTouched()) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  }, [form, onClose, isDirty]);

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
