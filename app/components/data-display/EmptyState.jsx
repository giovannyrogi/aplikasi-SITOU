import { Empty } from "antd";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
export default function EmptyState({ description = "Belum ada data.", compact = false }) {
  if (compact)
    return (
      <Box sx={{ p: 2, border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 2 }}>
        <FontStyle fontSize={14} color="text.secondary">
          {description}
        </FontStyle>
      </Box>
    );
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />;
}
