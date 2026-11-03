"use client";
import { Box } from "@mui/material";
import AppCollapse from "@/app/components/data-display/AppCollapse";
import SelectedEmployeesList from "./SelectedEmployeesList";
import EmployeeAvatar from "./EmployeeAvatar";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Inline disclosure shared by assignment and daily changes; grouped avatars are noninteractive. */
export default function SelectedEmployeesSummary({ employees, onPreview, disabled = false }) {
  const multiple = employees.length > 1;
  const content = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 1.5,
        minWidth: 0,
        width: "100%",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        {employees.slice(0, 3).map((employee, index) => (
          <Box key={employee.id} sx={{ ml: index ? -1 : 0, flexShrink: 0 }}>
            <EmployeeAvatar employee={employee} interactive={false} size={multiple ? 36 : 44} />
          </Box>
        ))}
        {employees.length > 3 && (
          <FontStyle component="span" fontSize={14} fontWeight={600} sx={{ ml: 1 }}>
            +{employees.length - 3} Pegawai lainnya
          </FontStyle>
        )}
        {multiple && employees.length <= 3 && (
          <FontStyle component="span" fontSize={14} fontWeight={600} sx={{ ml: 1 }}>
            Pegawai terpilih
          </FontStyle>
        )}
      </Box>
      {!multiple && (
        <Box sx={{ minWidth: 0, textAlign: "left" }}>
          <FontStyle fontSize={14} fontWeight={600}>
            {employees[0]?.full_name}
          </FontStyle>
          {!multiple && (
            <FontStyle fontSize={14} color="text.secondary">
              NIP {employees[0]?.employee_no || "—"}
            </FontStyle>
          )}
        </Box>
      )}
    </Box>
  );
  return multiple ? (
    <AppCollapse
      expandIconPlacement="end"
      styles={{ header: { alignItems: "center", gap: 12, padding: 12 }, body: { padding: 0 } }}
      items={[
        {
          key: "employees",
          label: content,
          collapsible: disabled ? "disabled" : undefined,
          forceRender: true,
          children: <SelectedEmployeesList employees={employees} onPreview={onPreview} />,
        },
      ]}
    />
  ) : (
    <Box sx={{ py: 1 }}>{content}</Box>
  );
}
