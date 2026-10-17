import pool from "@/lib/dbConfig";
import { readEmployeePersonalSummary } from "./employeePersonalRepository";
import { ServiceError } from "@/lib/api/routeHelpers";
import { actorHasPermission } from "@/lib/auth/permissions";
import { readPermissionScope } from "@/lib/access/packageRepository";
import { INVENTORY_READ_PERMISSIONS } from "@/lib/access/packagePolicy.mjs";
import { INVENTORY_DASHBOARD_PERMISSIONS, inventoryMonthRange, inventoryTrendRange, inventoryTrendChart, INVENTORY_ACTIVITY_KINDS } from "./inventoryPolicy.mjs";
import { readEmployeeDashboard, readInventoryDashboardStock, readInventoryDashboardTransactions, readInventoryDashboardDistribution } from "./workspaceRepository";

const hasAccess = (scope) => scope === null || scope.length > 0;

export async function getEmployeeDashboard(actor) {
  if (actor.role_code !== "employee") throw new ServiceError("SELF_ONLY", "Dashboard ini khusus Pegawai.", 403);
  const codes = ["employees.read_self", "assignments.read_self", "contracts.read_self", "leave_requests.read_self", "disciplinary_actions.read_self"];
  const allowed = await Promise.all(codes.map((code) => actorHasPermission(actor, code)));
  if (!allowed[0]) throw new ServiceError("SELF_FORBIDDEN", "Anda tidak memiliki akses profil sendiri.", 403);
  const row = await readEmployeeDashboard(actor, allowed);
  if (!row) throw new ServiceError("PROFILE_NOT_LINKED", "Akun belum terhubung ke profil Pegawai.", 404);
  return {
    today: row.today,
    organization: actor.organization_name,
    ...await readEmployeePersonalSummary(actor, allowed.slice(3)),
    profile: { name: row.full_name, nip: row.employee_no, photoUrl: row.profile_photo_file_id ? "/api/uploads/profile_self" : null },
    employment: { status: row.employment_status, joinedDate: row.joined_date, serviceYears: row.service_years, serviceMonths: row.service_months, serviceDays: row.service_days,
      ...(allowed[2] ? { type: row.employment_type_name } : {}) },
    ...(allowed[1] ? { assignment: { position: row.position_name, location: row.location_name, unit: row.unit_name, supervisor: row.supervisor_name } } : {}),
    ...(allowed[2] ? { contract: row.contract_status ? { status: row.contract_status, start: row.contract_start, end: row.contract_end, requiresEndDate: row.requires_end_date } : null } : {}),
  };
}

export async function getInventoryDashboard(actor, organizationId, warehouseId, requestId, trendPeriod = "year") {
  const codes = [...new Set([...INVENTORY_READ_PERMISSIONS, ...Object.values(INVENTORY_DASHBOARD_PERMISSIONS)])];
  const entries = await Promise.all(codes.map(async (code) => [code, await readPermissionScope(actor, organizationId, code)]));
  const scopes = Object.fromEntries(entries);
  if (!entries.some(([, scope]) => hasAccess(scope))) throw new ServiceError("INVENTORY_FORBIDDEN", "Akses Inventaris tidak tersedia.", 403);
  const org = (await pool.query("SELECT name,timezone,to_char((now() AT TIME ZONE timezone)::date,'YYYY-MM-DD') AS today FROM organizations WHERE id=$1", [organizationId])).rows[0];
  const all = entries.some(([, scope]) => scope === null);
  const union = all ? null : [...new Set(entries.flatMap(([, scope]) => scope))];
  const warehouses = (await pool.query(`SELECT warehouse.id::text,warehouse.name FROM inventory_warehouses warehouse
    JOIN locations location ON location.organization_id=warehouse.organization_id AND location.id=warehouse.location_id
    WHERE warehouse.organization_id=$1 AND warehouse.is_active AND location.is_active
      AND location.operational_from<=$3::date AND (location.operational_until IS NULL OR location.operational_until>=$3::date)
      AND ($2::bigint[] IS NULL OR warehouse.id=ANY($2::bigint[])) ORDER BY warehouse.name,warehouse.id`, [organizationId, union, org.today])).rows;
  if (warehouseId && !warehouses.some((entry) => entry.id === warehouseId))
    throw new ServiceError("WAREHOUSE_FORBIDDEN", "Gudang ini tidak tersedia dalam akses Anda.", 403, { warehouseId: "Pilih gudang yang tersedia." });
  const availableIds = new Set(warehouses.map((entry) => entry.id));
  const sections = [], tasks = [], unavailable = [];
  const range = inventoryMonthRange(org.today);
  const trendRange = inventoryTrendRange(org.today, trendPeriod);
  for (const [section, permission] of Object.entries(INVENTORY_DASHBOARD_PERMISSIONS)) {
    const scope = scopes[permission];
    if (!hasAccess(scope)) continue;
    const effective = scope === null ? [...availableIds] : scope.filter((id) => availableIds.has(id));
    if ((warehouseId && !effective.includes(warehouseId)) || !effective.length) { unavailable.push(section); continue; }
    sections.push(section);
    const args = [organizationId, effective, warehouseId || null];
    const task = section === "stock" ? readInventoryDashboardStock(...args)
      : section === "transactions" ? readInventoryDashboardTransactions(...args, { start: trendRange.start < range.start ? trendRange.start : range.start, end: org.today })
      : readInventoryDashboardDistribution(...args, range);
    tasks.push(task);
  }
  const results = await Promise.allSettled(tasks);
  const output = { organization: { id: organizationId, name: org.name }, sections, unavailable, warehouses,
    period: { start: range.start, end: range.end }, generatedAt: new Date().toISOString(), errors: {} };
  results.forEach((result, index) => {
    const section = sections[index];
    if (result.status === "rejected") {
      console.error(`dashboard.inventory.${section}`, requestId, result.reason);
      output.errors[section] = { message: "Data belum dapat dimuat. Coba lagi.", requestId };
      return;
    }
    const value = result.value;
    const monthly = section === "transactions" ? value.activity.filter((row) => row.occurred_on >= range.start) : [];
    output[section] = section === "transactions" ? {
      total: monthly.reduce((total, row) => total + row.count, 0),
      counts: INVENTORY_ACTIVITY_KINDS.map(([kind, label]) => ({ kind, label, value: monthly.filter((row) => row.kind === kind).reduce((n, row) => n + row.count, 0) })),
      chart: inventoryTrendChart(value.activity, trendRange), trendPeriod, recent: value.recent,
    } : value;
  });
  return output;
}
