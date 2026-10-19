/** Identitas penerima memakai profil dan jabatan utama terkini dalam organisasi dokumen. */
export const recipientPositionJoin = `LEFT JOIN LATERAL (
  SELECT position.name AS position_name FROM employee_assignments placement
  JOIN organizations organization ON organization.id=placement.organization_id
  LEFT JOIN positions position ON position.organization_id=placement.organization_id AND position.id=placement.position_id
  WHERE placement.organization_id=tx.organization_id AND placement.employee_id=recipient.id
    AND placement.assignment_type='primary'
    AND placement.effective_from<=(now() AT TIME ZONE organization.timezone)::date
    AND (placement.effective_until IS NULL OR placement.effective_until>=(now() AT TIME ZONE organization.timezone)::date)
  ORDER BY placement.effective_from DESC,placement.id DESC LIMIT 1
) recipient_assignment ON true`;
