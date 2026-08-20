import { Typography } from "@mui/material";

const FontStyle = ({ children, fontWeight = 500, fontSize = 12, sx = {}, ...props }) => {
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
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
};

export default FontStyle;
