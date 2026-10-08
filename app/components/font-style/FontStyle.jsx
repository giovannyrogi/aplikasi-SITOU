import { Typography } from "@mui/material";

const FontStyle = ({
  children,
  fontWeight = 500,
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
        fontFamily: "Poppins, sans-serif",
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
