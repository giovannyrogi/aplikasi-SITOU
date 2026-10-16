import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { writeAudit } from "@/lib/audit";
import { ServiceError } from "@/lib/api/routeHelpers";
import { listLeaveRequests } from "./service";
import { buildLeaveWorkbook } from "./workbook.mjs";

const EXPORT_LIMIT = 5000;

export async function exportLeaveRequests(filters, actor, requestId) {
  const snapshot = await withTransaction(async (database) => {
    await database.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const result = await listLeaveRequests({
      ...filters,
      actor,
      page: 1,
      pageSize: EXPORT_LIMIT + 1,
      database,
    });
    if (result.total > EXPORT_LIMIT)
      throw new ServiceError(
        "LEAVE_EXPORT_LIMIT",
        "Hasil melebihi 5.000 data. Persempit filter sebelum mengunduh Excel.",
        400,
      );
    const organization = await database.query(
      "SELECT name,(now() AT TIME ZONE timezone)::date::text AS today FROM organizations WHERE id=$1",
      [filters.organizationId],
    );
    if (!organization.rows[0])
      throw new ServiceError("NOT_FOUND", "Organisasi tidak ditemukan.", 404);
    return {
      rows: result.data,
      organization: organization.rows[0],
      asOf: organization.rows[0].today,
    };
  });
  const buffer = await buildLeaveWorkbook({ ...snapshot, filters });
  await writeAudit(pool, {
    organizationId: filters.organizationId,
    actorUserId: actor.id,
    action: "leave_request.export",
    entityType: "leave_request",
    entityId: "list",
    afterData: {
      count: snapshot.rows.length,
      startDate: filters.startDate,
      endDate: filters.endDate,
      requestStatus: filters.requestStatus,
    },
    requestId,
  });
  return { buffer, asOf: snapshot.asOf };
}
