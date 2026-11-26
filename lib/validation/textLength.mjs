// Count Unicode code points, matching mobile and PostgreSQL char_length.
export const textLength = (value) => Array.from(value || "").length;
export const limitText = (value, max) =>
  Array.from(value || "")
    .slice(0, max)
    .join("");
