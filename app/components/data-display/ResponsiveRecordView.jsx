"use client";

import { Box } from "@mui/material";
import RowActionMenu from "../actions/RowActionMenu";
import FontStyle from "../font-style/FontStyle";
import ResponsiveDataView from "./ResponsiveDataView";

function cellContent(column, row) {
  const value = column.dataIndex == null ? undefined : row[column.dataIndex];
  const render = column.cardRender || column.render;
  return (render ? render(value, row) : value) ?? "—";
}

/** Standard master/settings cards use the same fields as their desktop table. */
export default function ResponsiveRecordView({ columns, rowActions, renderCardBadges, ...props }) {
  const [heading, ...rest] = columns;
  const status = rest.find(({ key }) => key === "status");
  const action = rest.find(({ key }) => key === "action");
  const fields = (heading.cardAsField ? columns : rest).filter(
    (column) => column !== status && column !== action,
  );
  return (
    <ResponsiveDataView
      {...props}
      columns={columns}
      cardMediaQuery="(max-width:1199px)"
      cardColumns="repeat(auto-fit, minmax(min(100%, max(310px, 42%)), 1fr))"
      mobileCardSx={{ display: "flex", flexDirection: "column" }}
      renderCard={(row) => {
        const items = rowActions?.(row);
        const footer = items?.length ? (
          <RowActionMenu
            items={items}
            triggerLabel={`Aksi ${row.name || row.full_name || "baris"}`}
            buttonLabel="Aksi"
            fullWidth
          />
        ) : (
          action?.cardRender?.(undefined, row)
        );
        return (
          <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 1.25, minWidth: 0 }}>
            <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
              {!heading.cardAsField && (
                <FontStyle component="div" fontSize={14} fontWeight={700}>
                  {cellContent(heading, row)}
                </FontStyle>
              )}
              {(renderCardBadges || status) && (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                  {renderCardBadges?.(row)}
                  {status && cellContent(status, row)}
                </Box>
              )}
            </Box>
            {fields.length > 0 && (
              <Box
                component="dl"
                sx={{
                  flex: 1,
                  display: "grid",
                  alignContent: "start",
                  gap: 0.875,
                  m: 0,
                  pt: 1.25,
                  borderTop: 1,
                  borderColor: "divider",
                }}
              >
                {fields.map((column) => (
                  <Box
                    key={column.key || column.dataIndex || column.title}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 36%) minmax(0, 1fr)",
                      gap: 1,
                      alignItems: "baseline",
                    }}
                  >
                    <FontStyle component="dt" fontSize={12} color="text.secondary">
                      {column.title}
                    </FontStyle>
                    <FontStyle component="dd" fontSize={12} fontWeight={600} sx={{ m: 0 }}>
                      {cellContent(column, row)}
                    </FontStyle>
                  </Box>
                ))}
              </Box>
            )}
            {footer && (
              <Box
                component="footer"
                sx={{
                  mt: "auto",
                  pt: 1.25,
                  borderTop: 1,
                  borderColor: "divider",
                  "&:empty": { display: "none" },
                }}
              >
                {footer}
              </Box>
            )}
          </Box>
        );
      }}
    />
  );
}
