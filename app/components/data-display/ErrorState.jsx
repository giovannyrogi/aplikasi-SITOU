import { Button, Result } from "antd";
export default function ErrorState({ message = "Data tidak dapat dimuat.", onRetry }) {
  return (
    <Result
      status="error"
      title="Terjadi kendala"
      subTitle={message}
      extra={onRetry ? <Button onClick={onRetry}>Coba lagi</Button> : null}
    />
  );
}
