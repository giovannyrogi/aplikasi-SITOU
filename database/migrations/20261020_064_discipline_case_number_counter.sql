-- Nomor tidak bergantung pada tanggal kejadian yang dapat dikoreksi.
CREATE TABLE discipline_case_number_counters (
  organization_id bigint NOT NULL REFERENCES organizations(id),
  case_year integer NOT NULL CHECK (case_year BETWEEN 1 AND 9999),
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (organization_id,case_year)
);

-- Sertakan kasus terhapus; baca tahun dan angka dari nomor yang sudah diterbitkan.
-- Nomor lama tidak diubah. Suffix yang melampaui bigint menggagalkan migration
-- agar data tersebut ditinjau, bukan diabaikan lalu berisiko digunakan ulang.
INSERT INTO discipline_case_number_counters(organization_id,case_year,last_value)
SELECT organization_id,(parts)[1]::integer,max((parts)[2]::numeric)::bigint
FROM (
  SELECT organization_id,regexp_match(case_no,'^KASUS-([0-9]{4})-([0-9]+)$') AS parts
  FROM discipline_cases
) numbered
WHERE parts IS NOT NULL
GROUP BY organization_id,(parts)[1]::integer;

CREATE INDEX ix_discipline_cases_employee_recorded
  ON discipline_cases(organization_id,employee_id,opened_at DESC,id DESC)
  WHERE deleted_at IS NULL;
