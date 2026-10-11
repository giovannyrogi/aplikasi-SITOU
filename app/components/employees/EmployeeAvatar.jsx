"use client";

import PhotoAvatar from "@/app/components/data-display/PhotoAvatar";

/** Menampilkan pas foto privat pegawai; data tanpa foto hanya menampilkan inisial. */
export default function EmployeeAvatar({ employee, size = 44, onPreview }) {
  const fileId = employee?.profile_photo_file_id;
  const organizationId = employee?.organization_id;
  const name = employee?.full_name || "pegawai";
  const photoUrl =
    fileId && organizationId
      ? "/api/uploads/" +
        encodeURIComponent(fileId) +
        "?organizationId=" +
        encodeURIComponent(organizationId)
      : null;

  return (
    <PhotoAvatar
      key={photoUrl || name}
      photoUrl={photoUrl}
      name={name}
      size={size}
      photoLabel="Pas foto"
      previewTitle="Pas foto pegawai"
      onPreview={onPreview}
    />
  );
}
