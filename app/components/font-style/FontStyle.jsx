import { Typography } from "@mui/material";
import { APP_FONT_WEIGHTS } from "@/app/theme/typography";

const FontStyle = ({
  children,
  fontWeight = APP_FONT_WEIGHTS.regular,
  fontSize = 12,
  explanation = false,
  sx = {},
  ...props
}) => {
  return (
    <Typography
      {...props}
      sx={{
        fontWeight,
        fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize,
        whiteSpace: "pre-line",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        letterSpacing: 0,
        ...(explanation
          ? {
              textAlign: props.textAlign || "justify",
              textAlignLast: "auto",
              wordBreak: "normal",
              overflowWrap: "break-word",
            }
          : {}),
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
};

export default FontStyle;
