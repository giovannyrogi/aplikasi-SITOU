/** Ringkasan baca saja; hak awal mengikuti grant otomatis saat pencatatan pertama. */
export function previewLeaveBalance(type, balances = [], requestedUnits = 0, requests = []) {
  const entitlement = balances.find((item) => String(item.leave_type_id) === String(type.id));
  const transactions = entitlement?.transactions || [];
  const total = (kind) =>
    transactions
      .filter((item) => item.type === kind)
      .reduce((sum, item) => sum + Number(item.units), 0);
  const allowance = entitlement ? total("grant") : Number(type.annual_allowance || 0);
  const used = Math.max(0, -total("usage") - total("restoration"));
  const adjustments = total("adjustment") + total("carryover");
  const reserved = requests
    .filter(
      (r) =>
        String(r.leave_type_id) === String(type.id) &&
        ["submitted", "needs_revision"].includes(r.status),
    )
    .reduce((sum, r) => sum + Number(r.requested_units), 0);
  const remaining = (entitlement ? Number(entitlement.balance) : allowance) - reserved;
  return {
    allowance,
    used,
    adjustments,
    remaining,
    reserved,
    after: remaining - Number(requestedUnits || 0),
    automatic: !entitlement,
  };
}
