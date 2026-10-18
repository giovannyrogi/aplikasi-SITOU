"use client";

import {
  ApartmentOutlined,
  ArrowRightOutlined,
  RightOutlined,
  AppstoreOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CarryOutOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleFilled,
  DatabaseOutlined,
  AuditOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  IdcardOutlined,
  InfoCircleFilled,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  PictureOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  InboxOutlined,
  ImportOutlined,
  ExportOutlined,
  RollbackOutlined,
  UndoOutlined,
  PlusCircleOutlined,
  ShopOutlined,
  BookOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserDeleteOutlined,
  UserOutlined,
  WalletOutlined,
  WarningFilled,
  WarningOutlined,
} from "@ant-design/icons";
import { Icon } from "@iconify/react/dist/offline";
import { LOCAL_ICON_DATA } from "./localIconData.mjs";

const ICONS = {
  "inventory:catalog": BookOutlined,
  "inventory:warehouse": ShopOutlined,
  "subscription:access": SafetyCertificateOutlined,
  "solar:widget-5-bold-duotone": AppstoreOutlined,
  "solar:database-bold-duotone": DatabaseOutlined,
  "solar:buildings-2-bold-duotone": BankOutlined,
  "solar:buildings-3-bold-duotone": BankOutlined,
  "solar:map-point-wave-bold-duotone": EnvironmentOutlined,
  "solar:case-round-bold-duotone": CarryOutOutlined,
  "solar:document-add-bold-duotone": FileAddOutlined,
  "solar:users-group-rounded-bold-duotone": TeamOutlined,
  "fa6-solid:people-group": TeamOutlined,
  "solar:user-id-bold-duotone": IdcardOutlined,
  "solar:calendar-mark-bold-duotone": CalendarOutlined,
  "solar:calendar-date-bold-duotone": CalendarOutlined,
  "solar:calendar-minimalistic-bold-duotone": CalendarOutlined,
  "solar:calendar-search-bold-duotone": CalendarOutlined,
  "solar:calendar-add-bold-duotone": CalendarOutlined,
  "solar:calendar-remove-bold-duotone": CalendarOutlined,
  "solar:chart-2-bold-duotone": BarChartOutlined,
  "solar:chart-bold-duotone": BarChartOutlined,
  "solar:chart-square-bold-duotone": BarChartOutlined,
  "clarity:contract-solid": FileTextOutlined,
  "solar:document-text-bold-duotone": FileTextOutlined,
  "action:view-all": ArrowRightOutlined,
  "action:chevron-right": RightOutlined,
  "inventory:stock-card": UnorderedListOutlined,
  "inventory:minimum": SettingOutlined,
  "inventory:opening-correction": AuditOutlined,
  "solar:clipboard-list-bold-duotone": UnorderedListOutlined,
  "solar:checklist-minimalistic-bold-duotone": UnorderedListOutlined,
  "solar:clipboard-remove-bold-duotone": DeleteOutlined,
  "solar:shield-warning-bold-duotone": WarningOutlined,
  "solar:shield-check-bold-duotone": SafetyCertificateOutlined,
  "solar:shield-user-bold-duotone": SafetyCertificateOutlined,
  "solar:key-bold-duotone": KeyOutlined,
  "solar:key-minimalistic-square-3-bold-duotone": KeyOutlined,
  "solar:settings-bold-duotone": SettingOutlined,
  "solar:settings-minimalistic-bold-duotone": SettingOutlined,
  "solar:folder-with-files-bold-duotone": FolderOpenOutlined,
  "solar:structure-bold-duotone": ApartmentOutlined,
  "solar:user-linear": UserOutlined,
  "solar:lock-keyhole-linear": LockOutlined,
  "solar:lock-password-bold-duotone": LockOutlined,
  "solar:eye-linear": EyeOutlined,
  "solar:eye-closed-linear": EyeInvisibleOutlined,
  "solar:link-circle-bold-duotone": LinkOutlined,
  "solar:verified-check-bold-duotone": CheckCircleOutlined,
  "solar:user-check-rounded-bold-duotone": CheckCircleOutlined,
  "solar:user-block-rounded-bold-duotone": UserDeleteOutlined,
  "solar:check-circle-bold": CheckCircleFilled,
  "solar:close-circle-bold": CloseCircleFilled,
  "solar:danger-triangle-bold": WarningFilled,
  "solar:danger-triangle-bold-duotone": WarningOutlined,
  "solar:info-circle-bold": InfoCircleFilled,
  "solar:history-bold-duotone": HistoryOutlined,
  "solar:check-read-bold-duotone": FileDoneOutlined,
  "solar:bell-bing-bold-duotone": BellOutlined,
  "solar:refresh-linear": ReloadOutlined,
  "solar:restart-linear": ReloadOutlined,
  "solar:filter-bold-duotone": FilterOutlined,
  "solar:wallet-money-bold-duotone": WalletOutlined,
  "solar:gallery-wide-bold-duotone": PictureOutlined,
  "solar:gallery-minimalistic-linear": PictureOutlined,
  "solar:box-bold-duotone": InboxOutlined,
  "solar:inbox-in-bold-duotone": ImportOutlined,
  "solar:inbox-out-bold-duotone": ExportOutlined,
  "solar:restart-bold-duotone": RollbackOutlined,
  "solar:clipboard-check-bold-duotone": FileDoneOutlined,
  "solar:undo-left-bold-duotone": UndoOutlined,
  "solar:add-circle-bold": PlusCircleOutlined,
  "solar:add-circle-linear": PlusCircleOutlined,
  "solar:trash-bin-trash-linear": DeleteOutlined,
};

export default function AppIcon({ icon, width, height, fontSize, color, style, ...props }) {
  const size = fontSize ?? width ?? height;
  const iconData = LOCAL_ICON_DATA[icon];
  if (icon === "navigation:dashboard") {
    return (
      <span
        {...props}
        className={["app-dashboard-icon", props.className].filter(Boolean).join(" ")}
        style={{ fontSize: size, color, ...style }}
      >
        <Icon icon={iconData} className="app-dashboard-icon-animated" aria-hidden="true" />
        <Icon icon={LOCAL_ICON_DATA["navigation:dashboard-static"]} className="app-dashboard-icon-static" aria-hidden="true" />
      </span>
    );
  }
  if (iconData) {
    return <Icon icon={iconData} width={size} height={size} style={{ color, ...style }} {...props} />;
  }
  const IconComponent = ICONS[icon] || QuestionCircleOutlined;
  return (
    <IconComponent
      {...props}
      style={{
        ...(size ? { fontSize: size } : null),
        ...(color ? { color } : null),
        ...style,
      }}
    />
  );
}
