"use client";

import { useId } from "react";
import { Form, Switch } from "antd";
import { Box } from "@mui/material";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppNotice from "@/app/components/data-display/AppNotice";

/** Wadah terpusat untuk sekumpulan pengaturan on/off pada form domain. */
export function FormSettingsGroup({ children, sx }) {
  return (
    <Box
      sx={{
        borderTop: (theme) => `1px solid ${theme.ui.panelBorderSubtle}`,
        borderBottom: (theme) => `1px solid ${theme.ui.panelBorderSubtle}`,
        "& > .form-setting-switch + .form-setting-switch": {
          borderTop: (theme) => `1px solid ${theme.ui.panelBorderSubtle}`,
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Pengaturan boolean yang menyatukan label, bantuan, aksesibilitas, dan field lanjutan.
 * Field lanjutan dilepas dari tampilan saat nonaktif, tetapi nilainya tetap dipertahankan Form.
 */
export default function FormSettingSwitch({
  name,
  title,
  description,
  notice,
  disabled = false,
  disabledReason,
  children,
  switchProps = {},
  formItemProps = {},
}) {
  const form = Form.useFormInstance();
  const enabled = Form.useWatch(name, form);
  const descriptionId = useId();
  const helpText = disabled && disabledReason ? disabledReason : description;
  const currentNotice = notice ? (enabled ? notice.on : notice.off) : null;
  const switchHelp =
    disabled && disabledReason
      ? `${currentNotice?.description || ""} ${disabledReason}`.trim()
      : currentNotice?.description;
  const control = (
    <Form.Item
      {...formItemProps}
      name={name}
      valuePropName="checked"
      style={{ marginBottom: 0, flexShrink: 0, ...formItemProps.style }}
    >
      <Switch
        {...switchProps}
        disabled={disabled || switchProps.disabled}
        aria-label={switchProps["aria-label"] || title || currentNotice?.title}
        aria-describedby={(notice ? switchHelp : helpText) ? descriptionId : undefined}
        style={{ minWidth: 44, ...switchProps.style }}
      />
    </Form.Item>
  );

  if (notice) {
    return (
      <Box
        className="form-setting-switch"
        sx={{
          py: { xs: 2, sm: 2.25 },
          "& .ant-switch.ant-switch-checked": {
            backgroundColor: (theme) => theme.status.success.main,
          },
          "& .ant-switch.ant-switch-checked:hover:not(.ant-switch-disabled)": {
            backgroundColor: (theme) => theme.status.success.text,
          },
          "& .ant-switch.ant-switch-checked:focus-visible": {
            outline: (theme) => `3px solid ${theme.status.success.border}`,
            outlineOffset: 2,
          },
        }}
      >
        <AppNotice
          role="group"
          tone={currentNotice?.tone || (enabled ? "success" : "warning")}
          title={currentNotice?.title}
          description={switchHelp}
          descriptionId={descriptionId}
          action={control}
        />
        {enabled && children ? (
          <Box sx={{ pt: 2, maxWidth: 560, "& > .ant-form-item:last-child": { mb: 0 } }}>
            {children}
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <Box className="form-setting-switch" sx={{ py: { xs: 2, sm: 2.25 } }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: { xs: 2, sm: 3 },
        }}
      >
        <Box sx={{ minWidth: 0, pr: { sm: 1 } }}>
          <FontStyle component="div" fontSize={13.5} fontWeight={600}>
            {title}
          </FontStyle>
          {helpText ? (
            <FontStyle
              id={descriptionId}
              explanation
              component="div"
              fontSize={12.5}
              color="text.secondary"
              sx={{ mt: 0.5, lineHeight: 1.65 }}
            >
              {helpText}
            </FontStyle>
          ) : null}
        </Box>
        {control}
      </Box>
      {enabled && children ? (
        <Box sx={{ pt: 2, maxWidth: 560, "& > .ant-form-item:last-child": { mb: 0 } }}>
          {children}
        </Box>
      ) : null}
    </Box>
  );
}
