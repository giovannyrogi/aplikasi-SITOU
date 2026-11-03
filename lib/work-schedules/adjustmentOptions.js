import { hoursLabel } from "./dailyAdjustment.mjs";
import { patternAt } from "./definitionRevisions.mjs";

/** Do not expose auto-generated shift identities as unrelated choices. */
export async function adjustmentOptions(db, org, q, patterns, shiftAt, today, ctx) {
  const groups = (
    await db.query(
      `SELECT id::text,name FROM work_schedule_groups
    WHERE organization_id=$1 AND is_active AND (name ILIKE $2 OR EXISTS(
      SELECT 1 FROM work_schedule_group_items i WHERE i.organization_id=$1 AND i.group_id=work_schedule_groups.id AND i.is_current AND i.name ILIKE $2))
    ORDER BY name,id LIMIT 100`,
      [org, `%${q}%`],
    )
  ).rows;
  const items = (
    await db.query(
      `SELECT group_id::text,pattern_id::text,shift_id::text,name FROM work_schedule_group_items
    WHERE organization_id=$1 AND is_current ORDER BY position,id`,
      [org],
    )
  ).rows;
  const allMembers = new Set(
    (
      await db.query(
        "SELECT pattern_id::text FROM work_schedule_group_items WHERE organization_id=$1",
        [org],
      )
    ).rows.map((i) => i.pattern_id),
  );
  const standalone = patterns
    .filter((p) => !allMembers.has(p.id) && p.pattern_type === "weekly")
    .map((p) => ({
      id: `pattern:${p.id}`,
      name: p.name,
      kind: "weekly",
      choices: [{ patternId: p.id, name: p.name, days: p.days }],
    }));
  return [
    ...standalone,
    ...groups.map((g) => ({
      id: `group:${g.id}`,
      name: g.name,
      kind: "shift",
      choices: items
        .filter(
          (i) =>
            i.group_id === g.id &&
            ctx.patterns.some((p) => p.id === i.pattern_id && p.is_active) &&
            ctx.shifts.some((s) => s.id === i.shift_id && s.is_active),
        )
        .map((i) => {
          const shiftId =
            patternAt(ctx, i.pattern_id, today).days.flatMap((d) => d.shiftIds)[0] || i.shift_id;
          return {
            patternId: i.pattern_id,
            shiftId,
            name: i.name,
            label: `${i.name} · ${hoursLabel(shiftAt(ctx, shiftId, today).rules)}`,
            rules: shiftAt(ctx, shiftId, today).rules,
          };
        }),
    })),
  ].filter((s) => s.choices.length);
}
