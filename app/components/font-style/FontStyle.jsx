import { Typography } from "@mui/material";
import { APP_FONT_WEIGHTS } from "@/app/theme/typography";

/** Variabel area data hanya aktif di mobile; ukuran dasar di tempat lain tetap sama. */
const readableSize = (size) => {
  if (Array.isArray(size)) return size.map(readableSize);
  if (["inherit", "initial", "unset", "revert"].includes(size)) return size;
  if (size && typeof size === "object")
    return Object.fromEntries(
      Object.entries(size).map(([key, value]) => [key, readableSize(value)]),
    );
  const base = typeof size === "number" ? `${size}px` : size;
  return base
    ? `max(var(--sitou-data-font-min, var(--sitou-mobile-font-min, 0px)), calc(${base} + var(--sitou-data-font-boost, 0px)))`
    : base;
};

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
      data-sitou-font
      sx={{
        fontWeight,
        fontSize: readableSize(fontSize),
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
        ...(sx?.fontSize != null ? { fontSize: readableSize(sx.fontSize) } : {}),
      }}
    >
      {children}
    </Typography>
  );
};

export default FontStyle;
