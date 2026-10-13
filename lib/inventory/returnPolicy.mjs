/** Draft menyimpan semua baris; transaksi resmi hanya membawa barang yang kembali. */
export function transactionPayload(input) {
  return input.kind === "return" ? {...input,lines:input.lines.filter((line)=>Number(line.quantity)>0)} : input;
}

export function buildReturnLines(sourceLines, savedLines=[]) {
  return sourceLines.map((line)=>{
    const saved=savedLines.find((entry)=>String(entry.itemId)===String(line.itemId));
    return {itemId:Number(line.itemId),quantity:saved ? saved.quantity : line.canReturn ? Number(line.remainingQuantity) : 0};
  });
}
