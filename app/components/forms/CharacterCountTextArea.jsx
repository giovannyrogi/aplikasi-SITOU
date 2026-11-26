"use client";
import { forwardRef, useState } from "react";
import { Input, theme } from "antd";
import { textLength, limitText } from "@/lib/validation/textLength.mjs";

/** Limit feedback is visual; a value exactly at the limit remains valid. */
const CharacterCountTextArea = forwardRef(function CharacterCountTextArea(inputProps, ref) {
  const { value, defaultValue = "", onChange, maxLength, status, ...props } = inputProps;
  const [localValue, setLocalValue] = useState(defaultValue);
  const { token } = theme.useToken();
  const text = Object.hasOwn(inputProps, "value") ? (value ?? "") : localValue;
  const atLimit = textLength(text) >= maxLength;
  return (
    <Input.TextArea
      {...props}
      ref={ref}
      value={text}
      status={atLimit ? "error" : status}
      count={{
        show: ({ count }) => (
          <span style={{ color: atLimit ? token.colorError : token.colorTextSecondary }}>
            {count} / {maxLength} karakter
          </span>
        ),
        max: maxLength,
        strategy: textLength,
        exceedFormatter: (current, { max }) => limitText(current, max),
      }}
      onChange={(event) => {
        setLocalValue(event.target.value);
        onChange?.(event);
      }}
    />
  );
});
export default CharacterCountTextArea;
