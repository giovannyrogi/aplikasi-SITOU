export async function writeAudit(
  client,
  {
    organizationId = null,
    actorUserId,
    action,
    entityType,
    entityId,
    beforeData,
    afterData,
    requestId,
  },
) {
  await client.query(
    `INSERT INTO audit_logs (
      organization_id, actor_user_id, action, entity_type, entity_id,
      before_data, after_data, request_id
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::uuid)`,
    [
      organizationId,
      actorUserId,
      action,
      entityType,
      String(entityId),
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      requestId,
    ],
  );
}
