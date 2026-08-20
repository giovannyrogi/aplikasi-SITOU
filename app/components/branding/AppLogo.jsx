import Image from "next/image";

/**
 * Sumber tunggal aset logo SITOU. Ubah path di sini ketika branding berganti;
 * seluruh UI dan metadata aplikasi akan mengikuti konfigurasi yang sama.
 */
export const APP_LOGO_ASSETS = Object.freeze({
  full: "/logo-sitou-v1-transparent.png",
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
  const resolvedVariant = APP_LOGO_ASSETS[variant] ? variant : "full";
  const dimensions = DEFAULT_DIMENSIONS[resolvedVariant];

  return (
    <Image
      src={APP_LOGO_ASSETS[resolvedVariant]}
      alt={alt}
      width={width || dimensions.width}
      height={height || dimensions.height}
      priority={priority}
      style={{ objectFit: "contain", ...style }}
      {...imageProps}
    />
  );
}
