"use client";
import { useId } from "react";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";

/** Related fields share heading, spacing and separation across domain forms. */
export default function FormSection({
  title,
  description,
  action,
  children,
  divider = true,
  first = false,
}) {
  const headingId = useId();
  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{
        py: 3,
        minWidth: 0,
        borderBottom: divider ? 1 : 0,
        borderColor: "divider",
        pt: first ? 0 : 3,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <FontStyle component="h3" id={headingId} fontSize={16} fontWeight={600} sx={{ m: 0 }}>
            {title}
          </FontStyle>
          {description && (
            <FontStyle fontSize={14} color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </FontStyle>
          )}
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}
