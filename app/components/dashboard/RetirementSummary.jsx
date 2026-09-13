"use client";

import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { Button, Segmented, Skeleton, Tooltip } from "antd";
import { EyeOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import DataPanel from "../data-display/DataPanel";
import ImagePreviewModal from "../modals/ImagePreviewModal";
import { ReportIdentity, ReportDeadline } from "../reports/ReportEmployeeFields";
import { useLoadingBackdrop } from "../loading/LoadingBackdropProvider";

export default function RetirementSummary({ data, loading }) {
  const [mode, setMode] = useState("upcoming");
  const [photo, setPhoto] = useState(null);
  const router = useRouter();
  const { startNavigationLoading } = useLoadingBackdrop();
  const group = data?.[mode];
  const navigate = (href) => {
    startNavigationLoading();
    router.push(href);
  };
  return (
    <DataPanel
      title="Proyeksi pensiun"
      description="Usia acuan 58 tahun; hubungan kerja masih berjalan."
    >
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "grid", gap: 2 }}>
        <Box
          sx={{ "& .ant-segmented-item-label": { whiteSpace: "normal", lineHeight: 1.5, py: 1 } }}
        >
          <Segmented
            block
            value={mode}
            onChange={setMode}
            options={[
              { value: "upcoming", label: "Akan pensiun" },
              { value: "overdue", label: "Lewat usia pensiun" },
            ]}
          />
        </Box>
        {loading ? (
          <Skeleton active />
        ) : (
          <>
            <Box>
              <Typography sx={{ fontSize: 26, fontWeight: 700 }}>
                {group?.value || 0}{" "}
                <Box component="span" sx={{ fontSize: 13, fontWeight: 400 }}>
                  pegawai
                </Box>
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {mode === "upcoming"
                  ? "Mencapai usia pensiun dalam 12 bulan"
                  : "Sudah mencapai usia pensiun, masih tercatat bekerja"}
              </Typography>
            </Box>
            <Box
              role="region"
              aria-label="Daftar prioritas pensiun"
              tabIndex={0}
              sx={{
                maxHeight: 520,
                overflowY: "auto",
                pr: 0.5,
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none", width: 0, height: 0 },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: 2,
                },
              }}
            >
              {(group?.rows || []).map((row) => (
                <Box
                  key={row.employee_id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) 44px",
                    gap: 1.5,
                    py: 2,
                    borderTop: 1,
                    borderColor: "divider",
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
                    <ReportIdentity row={row} onPreview={setPhoto} />
                    <Typography
                      sx={{ fontSize: 12, color: "text.secondary", overflowWrap: "anywhere" }}
                    >
                      {row.position_name || "Jabatan belum ditentukan"} ·{" "}
                      {row.location_name || "Belum ditempatkan"}
                    </Typography>
                    <ReportDeadline row={row} retirement />
                  </Box>
                  <Tooltip title="Lihat pegawai">
                    <Button
                      icon={<EyeOutlined />}
                      aria-label={`Lihat pegawai ${row.full_name}`}
                      style={{ width: 44, height: 44 }}
                      onClick={() =>
                        navigate(
                          `/employees/${row.employee_id}?organizationId=${row.organization_id}&tab=summary`,
                        )
                      }
                    />
                  </Tooltip>
                </Box>
              ))}
            </Box>
            {!group?.rows?.length ? (
              <Typography sx={{ fontSize: 13, py: 2, color: "text.secondary" }}>
                Tidak ada pegawai dalam kelompok ini.
              </Typography>
            ) : null}
            <Button
              icon={<ArrowRightOutlined />}
              disabled={!group?.href}
              onClick={() => navigate(group.href)}
            >
              Lihat semua
            </Button>
          </>
        )}
      </Box>
      <ImagePreviewModal
        open={Boolean(photo)}
        onClose={() => setPhoto(null)}
        imageUrl={photo?.imageUrl}
        alt={photo?.alt}
        title={photo?.title}
      />
    </DataPanel>
  );
}
