export const CASE_STATUS = {
  open: ["Terbuka", "warning"],
  investigating: ["Dalam pemeriksaan", "info"],
  closed_no_action: ["Ditutup tanpa tindakan", "neutral"],
  action_issued: ["Tindakan diterbitkan", "danger"],
};

export const SEVERITY = {
  light: ["Ringan", "info"],
  moderate: ["Sedang", "warning"],
  severe: ["Berat", "danger"],
};

export const ACTION_LABELS = {
  oral_warning: "Teguran lisan",
  sp1: "SP1",
  sp2: "SP2",
  sp3: "SP3",
  suspension: "Skorsing",
  salary_delay: "Penundaan gaji",
  promotion_delay: "Penundaan promosi",
  demotion: "Demosi",
  fine: "Denda",
  termination: "Pengakhiran hubungan kerja",
  other: "Tindakan lain",
};

export const ACTION_STATUS = {
  draft: ["Draft", "neutral"],
  active: ["Aktif", "danger"],
  expired: ["Berakhir", "neutral"],
  revoked: ["Dicabut", "warning"],
  appealed: ["Dalam banding", "info"],
};
