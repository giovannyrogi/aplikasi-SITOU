/** Ukuran baca bersama untuk tabel/kartu mobile, termasuk metadata dan status. */
export const mobileDataTypography = {
  "@media (max-width:767px)": {
    "--sitou-data-font-min": "14px",
    "--sitou-data-font-boost": "2px",
    fontSize: 14,
    lineHeight: 1.5,
    "& .MuiTypography-root:not([data-sitou-font])": { fontSize: 14, lineHeight: 1.5 },
    "&& .MuiChip-label": {
      fontSize: 14,
      lineHeight: 1.5,
      whiteSpace: "normal",
      overflowWrap: "anywhere",
    },
    "& .ant-table-cell, & .ant-empty-description, & .ant-btn, & .ant-select": { fontSize: 14 },
    "&& .ant-table-wrapper .ant-table-thead > tr > th, && .ant-table-wrapper .ant-table-tbody > tr > td":
      { fontSize: 14 },
  },
};
