import { Empty } from "antd";
export default function EmptyState({ description = "Belum ada data." }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />;
}
