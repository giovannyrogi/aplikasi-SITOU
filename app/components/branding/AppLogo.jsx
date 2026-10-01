import Image from "next/image";

/**
 * Sumber tunggal aset logo SITOU. Ubah path di sini ketika branding berganti;
 * seluruh UI dan metadata aplikasi akan mengikuti konfigurasi yang sama.
 */
export const APP_LOGO_ASSETS = Object.freeze({
  mark: "/logo-sitou-v2-transparent.png",
});

const DEFAULT_DIMENSIONS = Object.freeze({
  full: { width: 164, height: 58 },
  mark: { width: 48, height: 48 },
});

export default function AppLogo({
  variant = "full",
  alt = "Logo SITOU",
  width,
  height,
  priority = false,
  style,
  ...imageProps
}) {
  const resolvedVariant = variant === "mark" ? "mark" : "full";
  const dimensions = DEFAULT_DIMENSIONS[resolvedVariant];
  const resolvedWidth = width || dimensions.width;
  const resolvedHeight = height || dimensions.height;

  if (resolvedVariant === "full") {
    return (
      <span
        role="img"
        aria-label={alt}
        style={{
          width: resolvedWidth,
          height: resolvedHeight,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          flexShrink: 0,
          ...style,
        }}
      >
        <Image
          src={APP_LOGO_ASSETS.mark}
          alt=""
          aria-hidden="true"
          width={44}
          height={52}
          priority={priority}
          style={{ width: 44, height: 52, objectFit: "contain", flexShrink: 0 }}
          {...imageProps}
        />
        <span
          aria-hidden="true"
          style={{
            color: "var(--sitou-brand-primary)",
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            whiteSpace: "nowrap",
          }}
        >
          SITOU
        </span>
      </span>
    );
  }

  return (
    <Image
      src={APP_LOGO_ASSETS.mark}
      alt={alt}
      width={width || dimensions.width}
      height={height || dimensions.height}
      priority={priority}
      style={{ objectFit: "contain", ...style }}
      {...imageProps}
    />
  );
}
