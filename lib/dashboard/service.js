import pool from "@/lib/dbConfig";
import { ServiceError } from "@/lib/api/routeHelpers";
import { getActorLocationScope } from "@/lib/auth/permissions";
import { ROLES } from "@/app/constants/roles";
import {
  formatDisciplineSeverity,
  formatDashboardActivity,
  formatSubscriptionStatus,
  normalizeDashboardRange,
} from "@/lib/dashboard/config.mjs";
import { effectiveSubscriptionStatusSql } from "@/lib/subscriptions/service";

const CACHE_TTL_MS = 60_000;
const dashboardCache = new Map();

/** Membaca cache singkat untuk menahan query agregasi berulang pada dashboard. */
function readCache(key) {
  const cached = dashboardCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    dashboardCache.delete(key);
    return null;
  }
  return cached.value;
}

/** Menyimpan hasil agregasi tanpa mencampur scope role, organisasi, dan lokasi. */
function writeCache(key, value) {
  dashboardCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Mengubah hasil query bernilai string menjadi angka aman untuk serialisasi chart. */
const asNumber = (value) => Number(value || 0);

/** Menyiapkan label aktivitas audit tanpa mengirim payload audit sensitif ke browser. */
function mapActivities(rows) {
  return rows.map((row) => ({
    id: row.id,
    label: formatDashboardActivity(row.action, row.entity_type),
    actor: row.actor_name || "Sistem",
    occurredAt: row.occurred_at,
  }));
}

/** Menyusun metrik serta grafik operasional untuk satu organisasi. */
async function getOrganizationDashboard({ actor, organizationId, startDate, endDate }) {
  const scopedLocationIds = await getActorLocationScope(actor);
  const params = [organizationId, startDate, endDate, scopedLocationIds];
  const employeeScope = `employee.organization_id=$1 AND employee.deleted_at IS NULL
    AND $2::date <= $3::date
    AND ($4::bigint[] IS NULL OR EXISTS (
      SELECT 1 FROM employee_assignments scoped_assignment
      WHERE scoped_assignment.organization_id=employee.organization_id
        AND scoped_assignment.employee_id=employee.id
        AND scoped_assignment.assignment_type='primary'
        AND scoped_assignment.effective_from<=current_date
        AND (scoped_assignment.effective_until IS NULL OR scoped_assignment.effective_until>=current_date)
        AND scoped_assignment.location_id=ANY($4::bigint[])
    ))`;

  const [
    organization,
    metrics,
    growth,
    locations,
    contracts,
    completeness,
    employment,
    discipline,
    attention,
    activities,
  ] = await Promise.all([
    pool.query(`SELECT id::text,code,name FROM organizations WHERE id=$1 AND is_active=true`, [
      organizationId,
    ]),
    pool.query(
      `WITH scoped AS (SELECT employee.* FROM employees employee WHERE ${employeeScope})
         SELECT
           count(*) FILTER (WHERE employment_status='active')::int AS active_employees,
           count(*) FILTER (WHERE employment_status IN ('active','probation','leave') AND NOT EXISTS (
             SELECT 1 FROM employee_assignments assignment
             WHERE assignment.organization_id=scoped.organization_id AND assignment.employee_id=scoped.id
               AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
               AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
           ))::int AS without_assignment,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM employment_contracts contract
             WHERE contract.organization_id=scoped.organization_id AND contract.employee_id=scoped.id
               AND contract.status='active' AND contract.end_date BETWEEN current_date AND current_date+30
           ))::int AS expiring_contracts,
           count(*) FILTER (WHERE national_id IS NULL OR profile_photo_file_id IS NULL
             OR NOT EXISTS (SELECT 1 FROM employee_contacts contact WHERE contact.organization_id=scoped.organization_id AND contact.employee_id=scoped.id)
             OR NOT EXISTS (SELECT 1 FROM employee_assignments assignment WHERE assignment.organization_id=scoped.organization_id AND assignment.employee_id=scoped.id AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date))
           )::int AS incomplete_profiles,
           (SELECT count(*)::int FROM disciplinary_actions action JOIN scoped s ON s.id=action.employee_id
             WHERE action.organization_id=$1 AND action.status='active') AS active_actions
         FROM scoped`,
      params,
    ),
    pool.query(
      `WITH months AS (
           SELECT generate_series(date_trunc('month',$2::date),date_trunc('month',$3::date),'1 month')::date AS month
         ), scoped AS (SELECT employee.* FROM employees employee WHERE ${employeeScope})
         SELECT to_char(months.month,'YYYY-MM') AS period,
           count(scoped.id) FILTER (WHERE scoped.joined_date IS NOT NULL AND scoped.joined_date < months.month+'1 month'::interval
             AND (scoped.termination_date IS NULL OR scoped.termination_date>=months.month))::int AS value
         FROM months LEFT JOIN scoped ON true GROUP BY months.month ORDER BY months.month`,
      params,
    ),
    pool.query(
      `SELECT location.name AS label,count(DISTINCT employee.id)::int AS value
         FROM employees employee JOIN employee_assignments assignment
           ON assignment.organization_id=employee.organization_id AND assignment.employee_id=employee.id
         JOIN locations location ON location.organization_id=assignment.organization_id AND location.id=assignment.location_id
         WHERE ${employeeScope} AND employee.employment_status IN ('active','probation','leave')
           AND assignment.assignment_type='primary' AND assignment.effective_from<=current_date
           AND (assignment.effective_until IS NULL OR assignment.effective_until>=current_date)
         GROUP BY location.id,location.name ORDER BY value DESC,location.name LIMIT 10`,
      params,
    ),
    pool.query(
      `WITH months AS (SELECT generate_series(date_trunc('month',$2::date),date_trunc('month',$3::date),'1 month')::date AS month),
         scoped AS (SELECT employee.* FROM employees employee WHERE ${employeeScope})
         SELECT to_char(months.month,'YYYY-MM') AS period,
           count(contract.id) FILTER (WHERE scoped.id IS NOT NULL AND contract.status='active')::int AS active,
           count(contract.id) FILTER (WHERE scoped.id IS NOT NULL AND contract.status IN ('renewed','expired'))::int AS completed
         FROM months LEFT JOIN employment_contracts contract
           ON contract.organization_id=$1 AND contract.end_date>=months.month AND contract.end_date<months.month+'1 month'::interval
         LEFT JOIN scoped ON scoped.id=contract.employee_id
         GROUP BY months.month ORDER BY months.month`,
      params,
    ),
    pool.query(
      `WITH scoped AS (SELECT employee.* FROM employees employee WHERE ${employeeScope}), scored AS (
           SELECT scoped.id,
             (CASE WHEN scoped.national_id IS NULL THEN 1 ELSE 0 END
              +CASE WHEN scoped.profile_photo_file_id IS NULL THEN 1 ELSE 0 END
              +CASE WHEN NOT EXISTS (SELECT 1 FROM employee_contacts c WHERE c.organization_id=scoped.organization_id AND c.employee_id=scoped.id) THEN 1 ELSE 0 END
              +CASE WHEN NOT EXISTS (SELECT 1 FROM employee_assignments a WHERE a.organization_id=scoped.organization_id AND a.employee_id=scoped.id AND a.assignment_type='primary' AND a.effective_from<=current_date AND (a.effective_until IS NULL OR a.effective_until>=current_date)) THEN 1 ELSE 0 END) AS missing
           FROM scoped WHERE scoped.employment_status IN ('active','probation','leave'))
         SELECT count(*) FILTER (WHERE missing=0)::int AS complete,
           count(*) FILTER (WHERE missing BETWEEN 1 AND 2)::int AS needs_review,
           count(*) FILTER (WHERE missing>=3)::int AS critical FROM scored`,
      params,
    ),
    pool.query(
      `WITH scoped AS (SELECT employee.* FROM employees employee WHERE ${employeeScope})
         SELECT employment_type.name AS label,
           count(contract.id) FILTER (WHERE scoped.id IS NOT NULL AND contract.status='active')::int AS active,
           count(contract.id) FILTER (WHERE scoped.id IS NOT NULL AND contract.status IN ('renewed','expired','terminated','cancelled'))::int AS historical
         FROM employment_types employment_type
         LEFT JOIN employment_contracts contract ON contract.organization_id=employment_type.organization_id
           AND contract.employment_type_id=employment_type.id
           AND contract.start_date<=$3::date
           AND COALESCE(contract.end_date,'infinity'::date)>=$2::date
         LEFT JOIN scoped ON scoped.id=contract.employee_id
         WHERE employment_type.organization_id=$1
         GROUP BY employment_type.id,employment_type.name ORDER BY employment_type.name`,
      params,
    ),
    pool.query(
      `WITH scoped AS (SELECT employee.* FROM employees employee WHERE ${employeeScope})
         SELECT case_data.severity AS label,count(*)::int AS value
         FROM discipline_cases case_data JOIN scoped ON scoped.id=case_data.employee_id
         WHERE case_data.organization_id=$1 AND case_data.incident_date BETWEEN $2::date AND $3::date AND EXISTS (
           SELECT 1 FROM disciplinary_actions action WHERE action.organization_id=case_data.organization_id
             AND action.discipline_case_id=case_data.id AND action.status<>'draft')
         GROUP BY case_data.severity ORDER BY case_data.severity`,
      params,
    ),
    pool.query(
      `WITH scoped AS (SELECT employee.* FROM employees employee WHERE ${employeeScope})
         SELECT * FROM (
           SELECT 'contract' AS type,scoped.id::text AS id,scoped.full_name AS title,
             'Kontrak berakhir pada '||to_char(contract.end_date,'DD Mon YYYY') AS description,
             contract.end_date::timestamptz AS due_at,1 AS priority
           FROM scoped JOIN employment_contracts contract ON contract.organization_id=scoped.organization_id AND contract.employee_id=scoped.id
           WHERE contract.status='active' AND contract.end_date BETWEEN current_date AND current_date+30
           UNION ALL
           SELECT 'assignment',scoped.id::text,scoped.full_name,'Belum memiliki penempatan aktif',current_date::timestamptz,2
           FROM scoped WHERE scoped.employment_status IN ('active','probation','leave') AND NOT EXISTS (
             SELECT 1 FROM employee_assignments a WHERE a.organization_id=scoped.organization_id AND a.employee_id=scoped.id
               AND a.assignment_type='primary' AND a.effective_from<=current_date AND (a.effective_until IS NULL OR a.effective_until>=current_date))
           UNION ALL
           SELECT 'discipline',scoped.id::text,scoped.full_name,'Memiliki tindakan disiplin aktif',action.effective_until::timestamptz,3
           FROM scoped JOIN disciplinary_actions action ON action.organization_id=scoped.organization_id AND action.employee_id=scoped.id
           WHERE action.status='active'
         ) item ORDER BY priority,due_at NULLS LAST LIMIT 8`,
      params,
    ),
    pool.query(
      `SELECT audit.id::text,audit.action,audit.entity_type,audit.occurred_at,identity.display_name AS actor_name
         FROM audit_logs audit LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
         WHERE audit.organization_id=$1
           AND audit.occurred_at >= $2::date
           AND audit.occurred_at < $3::date+interval '1 day'
         ORDER BY audit.occurred_at DESC LIMIT 6`,
      [organizationId, startDate, endDate],
    ),
  ]);

  if (!organization.rows[0]) {
    throw new ServiceError(
      "ORGANIZATION_NOT_FOUND",
      "Organisasi tidak ditemukan atau tidak aktif.",
      404,
    );
  }
  const m = metrics.rows[0];
  const c = completeness.rows[0];
  return {
    scope: "organization",
    organization: organization.rows[0],
    metrics: [
      {
        key: "activeEmployees",
        label: "Pegawai aktif",
        value: asNumber(m.active_employees),
        tone: "info",
        icon: "solar:users-group-rounded-bold-duotone",
      },
      {
        key: "withoutAssignment",
        label: "Tanpa penempatan",
        value: asNumber(m.without_assignment),
        tone: "warning",
        icon: "solar:map-point-wave-bold-duotone",
      },
      {
        key: "expiringContracts",
        label: "Kontrak segera berakhir",
        value: asNumber(m.expiring_contracts),
        tone: "danger",
        icon: "solar:document-text-bold-duotone",
      },
      {
        key: "incompleteProfiles",
        label: "Data belum lengkap",
        value: asNumber(m.incomplete_profiles),
        tone: "warning",
        icon: "solar:clipboard-list-bold-duotone",
      },
      {
        key: "activeActions",
        label: "Tindakan disiplin aktif",
        value: asNumber(m.active_actions),
        tone: "danger",
        icon: "solar:shield-warning-bold-duotone",
      },
    ],
    charts: {
      growth: {
        categories: growth.rows.map((r) => r.period),
        series: [{ name: "Pegawai", data: growth.rows.map((r) => asNumber(r.value)) }],
      },
      locations: {
        categories: locations.rows.map((r) => r.label),
        series: [{ name: "Pegawai", data: locations.rows.map((r) => asNumber(r.value)) }],
      },
      contracts: {
        categories: contracts.rows.map((r) => r.period),
        series: [
          { name: "Aktif", data: contracts.rows.map((r) => asNumber(r.active)) },
          { name: "Selesai/Diperpanjang", data: contracts.rows.map((r) => asNumber(r.completed)) },
        ],
      },
      completeness: {
        labels: ["Lengkap", "Perlu dilengkapi", "Kritis"],
        series: [asNumber(c.complete), asNumber(c.needs_review), asNumber(c.critical)],
      },
      employment: {
        categories: employment.rows.map((r) => r.label),
        series: [
          { name: "Aktif", data: employment.rows.map((r) => asNumber(r.active)) },
          { name: "Riwayat", data: employment.rows.map((r) => asNumber(r.historical)) },
        ],
      },
      discipline: {
        categories: discipline.rows.map((r) => formatDisciplineSeverity(r.label)),
        series: [{ name: "Kasus resmi", data: discipline.rows.map((r) => asNumber(r.value)) }],
      },
    },
    attentionItems: attention.rows,
    activities: mapActivities(activities.rows),
  };
}

/** Menyusun metrik lintas organisasi untuk Superadmin platform. */
async function getPlatformDashboard({ startDate, endDate }) {
  const [metrics, growth, access, topOrganizations, readiness, attention, activities] =
    await Promise.all([
      pool.query(`SELECT
      count(*) FILTER (WHERE organization.is_active AND EXISTS (SELECT 1 FROM organization_subscriptions subscription WHERE subscription.organization_id=organization.id AND subscription.status IN ('active','grace') AND current_date BETWEEN subscription.starts_on AND COALESCE(subscription.grace_ends_on,subscription.ends_on)))::int AS active_organizations,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM organization_subscriptions subscription WHERE subscription.organization_id=organization.id AND subscription.status='active' AND subscription.ends_on BETWEEN current_date AND current_date+30))::int AS expiring_organizations,
      count(*) FILTER (WHERE organization.is_active AND (NOT EXISTS (SELECT 1 FROM locations location WHERE location.organization_id=organization.id AND location.is_active) OR NOT EXISTS (SELECT 1 FROM employees employee WHERE employee.organization_id=organization.id AND employee.deleted_at IS NULL)))::int AS unready_organizations,
      (SELECT count(*)::int FROM employees employee WHERE employee.deleted_at IS NULL AND employee.employment_status='active') AS total_employees,
      (SELECT count(DISTINCT role_assignment.user_id)::int FROM user_organization_roles role_assignment JOIN users account ON account.id=role_assignment.user_id WHERE role_assignment.organization_id IS NOT NULL AND account.is_active AND role_assignment.active_from<=now() AND (role_assignment.active_until IS NULL OR role_assignment.active_until>now())) AS active_accounts
      FROM organizations organization`),
      pool.query(
        `WITH months AS (SELECT generate_series(date_trunc('month',$1::date),date_trunc('month',$2::date),'1 month')::date AS month)
      SELECT to_char(month,'YYYY-MM') AS period,count(organization.id) FILTER (WHERE organization.created_at<month+'1 month'::interval AND organization.is_active)::int AS value
      FROM months LEFT JOIN organizations organization ON true GROUP BY month ORDER BY month`,
        [startDate, endDate],
      ),
      pool.query(
        `SELECT COALESCE(current_subscription.effective_status,'not_configured') AS label,
          count(*)::int AS value
         FROM organizations organization
         LEFT JOIN LATERAL (
           SELECT ${effectiveSubscriptionStatusSql("subscription", "organization")} AS effective_status
           FROM organization_subscriptions subscription
           WHERE subscription.organization_id=organization.id
           ORDER BY CASE
             WHEN subscription.status NOT IN ('suspended','cancelled')
               AND (now() AT TIME ZONE organization.timezone)::date BETWEEN subscription.starts_on AND COALESCE(subscription.grace_ends_on,subscription.ends_on) THEN 0
             WHEN subscription.status NOT IN ('suspended','cancelled')
               AND subscription.starts_on>(now() AT TIME ZONE organization.timezone)::date THEN 1
             ELSE 2 END,
             subscription.starts_on DESC,subscription.id DESC
           LIMIT 1
         ) current_subscription ON true
         WHERE organization.is_active
         GROUP BY current_subscription.effective_status
         ORDER BY current_subscription.effective_status`,
      ),
      pool.query(`SELECT organization.name AS label,count(employee.id) FILTER (WHERE employee.deleted_at IS NULL AND employee.employment_status='active')::int AS value
      FROM organizations organization LEFT JOIN employees employee ON employee.organization_id=organization.id GROUP BY organization.id,organization.name ORDER BY value DESC,organization.name LIMIT 10`),
      pool.query(`SELECT organization.name AS label,
      (CASE WHEN EXISTS (SELECT 1 FROM locations location WHERE location.organization_id=organization.id AND location.is_active) THEN 25 ELSE 0 END
       +CASE WHEN EXISTS (SELECT 1 FROM user_organization_roles assignment JOIN roles role ON role.id=assignment.role_id WHERE assignment.organization_id=organization.id AND role.code='hrd' AND assignment.active_from<=now() AND (assignment.active_until IS NULL OR assignment.active_until>now())) THEN 25 ELSE 0 END
       +CASE WHEN EXISTS (SELECT 1 FROM organization_units unit WHERE unit.organization_id=organization.id AND unit.is_active) THEN 25 ELSE 0 END
       +CASE WHEN EXISTS (SELECT 1 FROM employees employee WHERE employee.organization_id=organization.id AND employee.deleted_at IS NULL) THEN 25 ELSE 0 END)::int AS value
      FROM organizations organization WHERE organization.is_active ORDER BY value,organization.name LIMIT 10`),
      pool.query(`SELECT organization.id::text,organization.name AS title,
      CASE WHEN subscription.ends_on IS NOT NULL THEN 'Masa akses berakhir pada '||to_char(subscription.ends_on,'DD Mon YYYY') ELSE 'Data operasional belum lengkap' END AS description,
      subscription.ends_on::timestamptz AS due_at,
      CASE WHEN subscription.ends_on BETWEEN current_date AND current_date+7 THEN 1 WHEN subscription.ends_on BETWEEN current_date AND current_date+30 THEN 2 ELSE 3 END AS priority,
      'organization' AS type
      FROM organizations organization LEFT JOIN LATERAL (SELECT ends_on FROM organization_subscriptions s WHERE s.organization_id=organization.id AND s.status='active' ORDER BY ends_on DESC LIMIT 1) subscription ON true
      WHERE organization.is_active AND (subscription.ends_on BETWEEN current_date AND current_date+30 OR NOT EXISTS (SELECT 1 FROM locations l WHERE l.organization_id=organization.id AND l.is_active) OR NOT EXISTS (SELECT 1 FROM employees e WHERE e.organization_id=organization.id AND e.deleted_at IS NULL))
      ORDER BY priority,due_at NULLS LAST LIMIT 8`),
      pool.query(`SELECT audit.id::text,audit.action,audit.entity_type,audit.occurred_at,identity.display_name AS actor_name
      FROM audit_logs audit LEFT JOIN v_user_identity identity ON identity.user_id=audit.actor_user_id
      WHERE audit.occurred_at >= $1::date AND audit.occurred_at < $2::date+interval '1 day'
      ORDER BY audit.occurred_at DESC LIMIT 6`, [startDate,endDate]),
    ]);
  const m = metrics.rows[0];
  return {
    scope: "platform",
    organization: null,
    metrics: [
      {
        key: "activeOrganizations",
        label: "Organisasi aktif",
        value: asNumber(m.active_organizations),
        tone: "success",
        icon: "solar:buildings-2-bold-duotone",
      },
      {
        key: "expiringOrganizations",
        label: "Masa akses segera berakhir",
        value: asNumber(m.expiring_organizations),
        tone: "warning",
        icon: "solar:calendar-mark-bold-duotone",
      },
      {
        key: "unreadyOrganizations",
        label: "Organisasi belum siap",
        value: asNumber(m.unready_organizations),
        tone: "danger",
        icon: "solar:clipboard-remove-bold-duotone",
      },
      {
        key: "totalEmployees",
        label: "Total pegawai aktif",
        value: asNumber(m.total_employees),
        tone: "info",
        icon: "solar:users-group-rounded-bold-duotone",
      },
      {
        key: "activeAccounts",
        label: "Akun organisasi aktif",
        value: asNumber(m.active_accounts),
        tone: "info",
        icon: "solar:key-minimalistic-square-3-bold-duotone",
      },
    ],
    charts: {
      growth: {
        categories: growth.rows.map((r) => r.period),
        series: [{ name: "Organisasi aktif", data: growth.rows.map((r) => asNumber(r.value)) }],
      },
      access: {
        categories: access.rows.map((r) => formatSubscriptionStatus(r.label)),
        series: [{ name: "Organisasi", data: access.rows.map((r) => asNumber(r.value)) }],
      },
      topOrganizations: {
        categories: topOrganizations.rows.map((r) => r.label),
        series: [
          { name: "Pegawai aktif", data: topOrganizations.rows.map((r) => asNumber(r.value)) },
        ],
      },
      readiness: {
        categories: readiness.rows.map((r) => r.label),
        series: [{ name: "Kesiapan (%)", data: readiness.rows.map((r) => asNumber(r.value)) }],
      },
    },
    attentionItems: attention.rows,
    activities: mapActivities(activities.rows),
  };
}

/** Endpoint service utama yang mengunci scope role dan memakai cache terpisah. */
export async function getDashboardSummary({
  actor,
  requestedOrganizationId,
  requestedStartDate,
  requestedEndDate,
}) {
  let range;
  try {
    range = normalizeDashboardRange(requestedStartDate, requestedEndDate);
  } catch (error) {
    throw new ServiceError("INVALID_DASHBOARD_RANGE", error.message, 400);
  }
  const isSuperadmin = actor.role_code === ROLES.SUPERADMIN;
  const organizationId = isSuperadmin
    ? requestedOrganizationId || null
    : String(actor.organization_id || "");
  if (!isSuperadmin && !organizationId) {
    throw new ServiceError("ORGANIZATION_REQUIRED", "Organisasi pada sesi tidak tersedia.", 400);
  }
  const locationScope = await getActorLocationScope(actor);
  const cacheKey = [
    actor.role_code,
    organizationId || "platform",
    range.startDate,
    range.endDate,
    locationScope?.join(",") || "all",
  ].join(":");
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const dashboard = organizationId
    ? await getOrganizationDashboard({ actor, organizationId, ...range })
    : await getPlatformDashboard(range);
  return writeCache(cacheKey, {
    ...dashboard,
    role: actor.role_code,
    range,
    generatedAt: new Date().toISOString(),
  });
}
