/** Jumlah stok dihitung dalam satuan 1/1000; tidak mengakumulasi floating point. */
export function scaled(value) {
  const text = String(value);
  if (!/^-?\d+(\.\d{1,3})?$/.test(text)) throw new RangeError("Jumlah harus memiliki maksimal tiga angka desimal.");
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const result = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
  return negative ? -result : result;
}
export function unscaled(value) {
  const n = BigInt(value), abs = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${abs / 1000n}.${String(abs % 1000n).padStart(3, "0")}`;
}
export class ReplayError extends Error {
  constructor(code, facts) { super(code); this.code = code; this.facts = facts; }
}
/** Original documents are retained; only their effective stock effects are derived. */
export function replayStock(source, correction = null) {
  const entries = source.map((row) => ({ ...row,
    effectiveDate: row.kind === "opening" && correction ? correction.occurredOn : row.occurredOn,
  })).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)
    || (a.kind === "opening" ? -1 : b.kind === "opening" ? 1 : BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  const opening = entries.find((row) => row.kind === "opening");
  const firstOperational = entries.find((row) => row.kind !== "opening");
  if (opening && firstOperational && opening.effectiveDate > firstOperational.effectiveDate)
    throw new ReplayError("BEFORE_OPENING", { date: firstOperational.effectiveDate, openingDate: opening.effectiveDate });
  let balance = 0n;
  const effects = new Map();
  const rows = entries.map((row) => {
    const before = balance;
    let delta = scaled(row.delta);
    if (row.kind === "opening") delta = scaled(correction?.quantity ?? row.quantity);
    if (row.kind === "stocktake") delta = scaled(row.quantity) - balance;
    if (row.kind === "reversal" && row.reversalOfId) {
      const effective = effects.get(String(row.reversalOfId));
      if (effective === undefined) throw new ReplayError("REVERSAL_SOURCE_INVALID", { date: row.effectiveDate });
      delta = -effective;
    }
    balance += delta;
    if (balance < 0n) throw new ReplayError("HISTORICAL_STOCK_NEGATIVE", { date: row.effectiveDate, quantity: unscaled(balance) });
    if (balance > 999999999999999999n) throw new ReplayError("STOCK_LIMIT_EXCEEDED", { date: row.effectiveDate });
    effects.set(String(row.transactionId), delta);
    return { ...row, effectiveDelta: unscaled(delta), balance: unscaled(balance), before: unscaled(before) };
  });
  return { rows, quantity: unscaled(balance), initialized: rows.length > 0 };
}
