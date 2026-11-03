import { dateValid } from "../work-schedules/rules.mjs";

const months = [
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
];
const weekdays = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const clean = (value) => value.replace(/[|¦]/g, " ").replace(/\s+/g, " ").trim();
export function tsvWords(tsv) {
  return tsv
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const p = line.split("\t");
      if (p[0] !== "5" || !p.slice(11).join("\t").trim()) return [];
      return [
        {
          x: +p[6],
          y: +p[7],
          width: +p[8],
          height: +p[9],
          confidence: +p[10],
          text: p.slice(11).join("\t"),
        },
      ];
    });
}
function lines(words) {
  const groups = [];
  for (const word of words
    .filter((w) => !/^[|¦]$/.test(w.text) && w.height >= 4)
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = groups.findLast(
      (r) => Math.abs(r.y - word.y) < Math.max(4, Math.min(r.height, word.height) * 0.55),
    );
    if (!row) {
      row = { y: word.y, height: word.height, words: [] };
      groups.push(row);
    }
    row.words.push(word);
  }
  return groups
    .sort((a, b) => a.y - b.y)
    .map((r) => ({
      ...r,
      words: r.words.sort((a, b) => a.x - b.x),
      text: clean(
        r.words
          .sort((a, b) => a.x - b.x)
          .map((w) => w.text)
          .join(" "),
      ),
    }));
}
export function expandHolidayDates(value, year) {
  const text = clean(value)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/(\d)([a-z])/g, "$1 $2");
  const month = months.findIndex((m) => new RegExp(`\\b${m}\\b`).test(text));
  if (month < 0) return null;
  const prefix = text.split(months[month])[0].trim();
  if (!/^[\d\s,\-dan]+$/.test(prefix)) return null;
  const numbers = [];
  for (const part of prefix
    .split(/,|\bdan\b/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const match = part.match(/^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/);
    if (!match) return null;
    const start = +match[1],
      end = +(match[2] || match[1]);
    if (end < start || end - start > 30) return null;
    for (let day = start; day <= end; day++) numbers.push(day);
  }
  const dates = numbers.map(
    (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  );
  return dates.length && dates.every(dateValid) ? dates : null;
}

/** Only numbered rows inside identified holiday tables become candidates. */
export function parseHolidayPages(pages, requestedYear) {
  const days = [],
    issues = [],
    foundYears = new Set(),
    sections = new Set(),
    decisions = [];
  const serials = { national: [], joint_leave: [] };
  let category = null,
    columns = null,
    current = null,
    unclearDecision = false;
  const flush = () => {
    if (!current) return;
    const row = current;
    current = null;
    const dateText = clean(row.date.join(" ")),
      name = clean(row.name.join(" "));
    const dates = expandHolidayDates(dateText, requestedYear);
    serials[row.category].push(row.serial);
    if (!dates || !name || name.length > 100) {
      issues.push({
        page: row.page,
        message: `Baris ${row.serial}: tanggal atau nama belum terbaca lengkap.`,
        raw: row.raw.join(" "),
      });
      return;
    }
    const dayWords = clean(row.weekday.join(" ")).toLowerCase();
    const actualWeekdays = dates.map((d) => weekdays[new Date(`${d}T00:00:00Z`).getUTCDay()]);
    const weekdayMismatch = actualWeekdays.some((d) => !dayWords.includes(d));
    const review = weekdayMismatch || row.confidence.some((c) => c < 85);
    for (const date of dates)
      days.push({
        date,
        name,
        category: row.category,
        page: row.page,
        bbox: row.bbox,
        raw: row.raw.join(" "),
        needsReview: review,
        reviewReason: weekdayMismatch
          ? "Nama hari perlu dicocokkan."
          : review
            ? "Tulisan kurang jelas."
            : "",
      });
  };
  for (const page of pages) {
    for (const line of lines(page.words)) {
      const upper = line.text.toUpperCase();
      const decision = upper.match(/NOMOR\s*:?\s*(\d+)\s+TAHUN\s+(20\d{2})/);
      if (decision) decisions.push(`${decision[1]}/${decision[2]}`);
      else if (/^NOMOR\b/.test(upper)) unclearDecision = true;
      const heading = upper.match(
        /(?:HARI\s+)?LIBUR\s+NASIONAL\s+TAHUN\s+(20\d{2})|CUTI\s+BERSAMA\s+TAHUN\s+(20\d{2})/,
      );
      if (heading && !upper.includes("DAN CUTI")) {
        flush();
        category = heading[1] ? "national" : "joint_leave";
        sections.add(category);
        foundYears.add(+(heading[1] || heading[2]));
        columns = null;
        continue;
      }
      const dateWord = line.words.find((w) => /TANGGAL/i.test(w.text));
      const dayWord = line.words.find((w) => /^HARI$/i.test(w.text));
      const nameWord = line.words.find((w) => /KETERANGAN/i.test(w.text));
      if (category && dateWord && dayWord && nameWord) {
        flush();
        const rules = (page.rules || []).filter(
          (r) => r.y <= line.y + line.height && r.y + r.height >= line.y,
        );
        const border = (left, right, fallback) => {
          const candidates = rules
            .filter((r) => r.x > left && r.x < right)
            .map((r) => r.x)
            .sort((a, b) => a - b);
          return candidates.length ? candidates[Math.floor(candidates.length / 2)] : fallback;
        };
        // Column borders lie between header centers; table layout may differ per page.
        columns = {
          date: border(line.words[0].x, dateWord.x, (line.words[0].x + dateWord.x) / 2),
          weekday: border(
            dateWord.x + dateWord.width,
            dayWord.x,
            (dateWord.x + dateWord.width + dayWord.x) / 2,
          ),
          name: border(
            dayWord.x + dayWord.width,
            nameWord.x,
            dayWord.x + dayWord.width + page.width * 0.03,
          ),
          width: page.width,
        };
        continue;
      }
      if (!category || !columns) continue;
      if (/MENTERI|DITETAPKAN|SALINAN SESUAI|^PRESIDEN/.test(upper)) {
        flush();
        category = null;
        continue;
      }
      const scale = page.width / columns.width;
      const col = {
        date: columns.date * scale,
        weekday: columns.weekday * scale,
        name: columns.name * scale,
      };
      const serial = line.words.find((w) => w.x < col.date && /^\d{1,3}[.)]?$/.test(w.text));
      if (
        !serial &&
        !current &&
        line.words.some((w) => w.x < page.width * 0.3 && /^\d{1,3}[.)]$/.test(w.text)) &&
        months.some((m) => line.text.toLowerCase().includes(m))
      )
        issues.push({
          page: page.page,
          message: "Posisi tabel lanjutan belum terbaca. Cocokkan seluruh baris dengan PDF.",
          raw: line.text,
        });
      if (serial) {
        flush();
        current = {
          serial: parseInt(serial.text),
          category,
          page: page.page,
          date: [],
          weekday: [],
          name: [],
          raw: [],
          confidence: [],
          bbox: { x: serial.x, y: line.y, width: page.width - serial.x, height: line.height },
        };
      }
      if (current) {
        current.raw.push(line.text);
        current.bbox.height = Math.max(current.bbox.height, line.y + line.height - current.bbox.y);
        for (const word of line.words) {
          if (word === serial || word.x < col.date || /^[|¦]$/.test(word.text)) continue;
          current[word.x < col.weekday ? "date" : word.x < col.name ? "weekday" : "name"].push(
            word.text,
          );
          current.confidence.push(word.confidence);
        }
      }
    }
    flush();
  }
  if (foundYears.size !== 1 || !foundYears.has(requestedYear))
    issues.push({ message: "Tahun pada lampiran belum cocok dengan tahun katalog." });
  if (sections.size !== 2)
    issues.push({
      message: "Tabel libur nasional dan cuti bersama belum teridentifikasi lengkap.",
    });
  for (const [key, values] of Object.entries(serials)) {
    if (!values.length || values.some((v, i) => v !== i + 1))
      issues.push({
        message: `Urutan baris ${key === "national" ? "libur nasional" : "cuti bersama"} belum lengkap.`,
      });
  }
  if (!days.length || days.length > 366 || new Set(days.map((d) => d.date)).size !== days.length)
    issues.push({ message: "Tanggal kosong, berulang, atau melebihi batas." });
  return {
    year: requestedYear,
    detectedYears: [...foundYears],
    yearMismatch: foundYears.size > 0 && (foundYears.size !== 1 || !foundYears.has(requestedYear)),
    decisionNumber: unclearDecision ? "" : [...new Set(decisions)].join(", "),
    metadataIssues: unclearDecision
      ? ["Nomor keputusan belum terbaca lengkap. Isi sesuai PDF sumber."]
      : [],
    days,
    issues,
    complete: issues.length === 0,
  };
}
