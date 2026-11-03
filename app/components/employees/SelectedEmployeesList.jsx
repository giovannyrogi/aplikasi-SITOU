"use client";
import { Box } from "@mui/material";
import EmployeeAvatar from "./EmployeeAvatar";
import FontStyle from "@/app/components/font-style/FontStyle";
/** Compact, independently scrollable identity list shared by both schedule dialogs. */
export default function SelectedEmployeesList({ employees, onPreview }) {
  return (
    <Box>
      <Box
        role="region"
        aria-label="Daftar Pegawai terpilih"
        tabIndex={0}
        sx={{
          maxHeight: "min(360px, 40dvh)",
          overflowY: "auto",
          overscrollBehaviorY: "contain",
          minWidth: 0,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: -2,
          },
        }}
      >
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {employees.map((employee) => (
            <Box
              component="li"
              key={employee.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                minWidth: 0,
                "& + li": { borderTop: 1, borderColor: "divider" },
              }}
            >
              <EmployeeAvatar employee={employee} onPreview={onPreview} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <FontStyle fontSize={14} fontWeight={600}>
                  {employee.full_name}
                </FontStyle>
                <FontStyle fontSize={14} color="text.secondary">
                  NIP {employee.employee_no || "—"}
                </FontStyle>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
        <FontStyle role="status" fontSize={14} color="text.secondary">
          Total: {employees.length} Pegawai
        </FontStyle>
      </Box>
    </Box>
  );
}
