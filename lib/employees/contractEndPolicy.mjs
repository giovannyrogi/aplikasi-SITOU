export function isClosedContract(contract) {
  return ["renewed", "expired", "terminated"].includes(contract?.status);
}

export function contractEndError(requiresEndDate, endDate, { historicalEndDate = null } = {}) {
  if (requiresEndDate && !endDate)
    return {
      code: "CONTRACT_END_REQUIRED",
      message: "Tanggal akhir wajib diisi untuk jenis kepegawaian ini.",
    };
  if (!requiresEndDate && endDate && endDate !== historicalEndDate)
    return {
      code: "CONTRACT_END_NOT_APPLICABLE",
      message: "Tanggal akhir tidak digunakan untuk jenis kepegawaian ini.",
    };
  return null;
}

/** Tanggal kedaluwarsa dan penutupan periode adalah dua informasi berbeda. */
export function contractEndPresentation(contract) {
  if (!contract) return null;
  if (contract.requires_end_date === true)
    return { label: "Akhir kontrak", value: contract.end_date };
  if (isClosedContract(contract) && contract.end_date)
    return { label: "Tanggal penutupan periode", value: contract.end_date };
  return null;
}
