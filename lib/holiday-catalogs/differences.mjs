/** Pure comparison shared by the source preview. A date is the calendar's unique key. */
export function holidayDifferences(previous = [], incoming = []) {
  const before = new Map(previous.map((d) => [d.date, d])),
    after = new Map(incoming.map((d) => [d.date, d]));
  return {
    added: incoming.filter((d) => !before.has(d.date)),
    removed: previous.filter((d) => !after.has(d.date)),
    changed: incoming.filter((d) => {
      const p = before.get(d.date);
      return p && (p.name !== d.name || p.category !== d.category);
    }),
    unchanged: incoming.filter((d) => {
      const p = before.get(d.date);
      return p && p.name === d.name && p.category === d.category;
    }).length,
  };
}
