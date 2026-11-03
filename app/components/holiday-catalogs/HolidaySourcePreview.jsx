"use client";
import { Box } from "@mui/material";
import AppNotice from "@/app/components/data-display/AppNotice";
import FontStyle from "@/app/components/font-style/FontStyle";
import { holidayDifferences } from "@/lib/holiday-catalogs/differences.mjs";
import HolidayDateList, { categoryLabel, displayDate } from "./HolidayDateList";
export default function HolidaySourcePreview({ candidate, previous }) {
  const difference = holidayDifferences(previous, candidate.days);
  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <AppNotice
        title={`Data ${candidate.year} siap ditinjau`}
        description="Periksa tanggal dan kategori terhadap SKB. Menyimpan hasil ini mengganti seluruh tanggal dan sumber pada draft, tanpa menerbitkannya."
      />
      <Box sx={{ display: "grid", gap: 1 }}>
        <FontStyle>Penyedia: {candidate.provider}</FontStyle>
        <FontStyle>Diambil: {new Date(candidate.fetchedAt).toLocaleString("id-ID")}</FontStyle>
        <FontStyle>SKB {candidate.decisionNumber}</FontStyle>
        <FontStyle>
          <a href={candidate.sourceUrl} target="_blank" rel="noopener noreferrer">
            Buka sumber resmi
          </a>
        </FontStyle>
      </Box>
      <AppNotice
        title={`${candidate.days.length} tanggal · ${difference.unchanged} tetap`}
        description={`${difference.added.length} tambahan, ${difference.changed.length} perubahan, ${difference.removed.length} dihapus dari draft jika Anda menyimpan hasil ini.`}
      />
      {difference.removed.length > 0 && (
        <AppNotice tone="warning" title="Tanggal yang tidak ada pada hasil sumber">
          <Box sx={{ display: "grid", gap: 1 }}>
            {difference.removed.map((d) => (
              <FontStyle key={d.date}>
                {displayDate(d.date)} · {d.name || "Nama belum diisi"} · {categoryLabel(d.category)}
              </FontStyle>
            ))}
          </Box>
        </AppNotice>
      )}
      <HolidayDateList
        days={candidate.days.map((d, i) => ({ ...d, id: String(i) }))}
        previous={(d) => {
          const old = previous.find((p) => p.date === d.date);
          return old && (old.name !== d.name || old.category !== d.category)
            ? `${old.name || "Nama belum diisi"} · ${categoryLabel(old.category)}`
            : null;
        }}
      />
    </Box>
  );
}
