/** Offset daftar server/client; cursor dapat memasok offset eksplisit dari API. */
export function rowNumberOffset(pagination, explicitOffset) {
  if (Number.isSafeInteger(explicitOffset) && explicitOffset >= 0) return explicitOffset;
  const page = Number(pagination?.page ?? pagination?.current ?? 1);
  const size = Number(pagination?.pageSize ?? 10);
  return Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(size) && size > 0
    ? (page - 1) * size
    : 0;
}

/** Nomor merupakan urutan tampilan, bukan ID domain dan tidak mengubah record sumber. */
export function numberedColumns(columns, offset) {
  return [
    {
      key: "__rowNumber",
      title: "No",
      width: 72,
      align: "center",
      render: (_value, _record, index) => offset + index + 1,
    },
    ...columns,
  ];
}
