"use client";

import { useEffect, useState } from "react";
import { Box, LinearProgress, Typography } from "@mui/material";

let estimatorPromise;
function loadEstimator() {
  if (!estimatorPromise)
    estimatorPromise = Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
    ]).then(
      ([core, common, english]) =>
        new core.ZxcvbnFactory({
          translations: english.translations,
          graphs: common.adjacencyGraphs,
          dictionary: { ...common.dictionary, ...english.dictionary },
        }),
    );
  return estimatorPromise;
}

/** Estimasi lokal; hasil tidak memblokir kata sandi pendek atau dikirim keluar browser. */
export default function PasswordStrengthIndicator({ password, active }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      loadEstimator()
        .then((estimator) => {
          if (!cancelled)
            setResult({
              password,
              score: password ? estimator.check(password, ["sitou", "backup"]).score : null,
            });
        })
        .catch(() => {
          if (!cancelled) setResult({ password, failed: true });
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [password, active]);
  if (!active || !password) return null;
  const current = result?.password === password ? result : null;
  const strength =
    current?.score == null
      ? null
      : current.score < 2
        ? { label: "Lemah", color: "error", value: 25 }
        : current.score === 2
          ? { label: "Sedang", color: "warning", value: 60 }
          : { label: "Kuat", color: "success", value: 100 };
  return (
    <Box sx={{ mt: 1.5, display: "grid", gap: 0.75, minWidth: 0 }}>
      <Typography variant="caption" role="status" aria-live="polite">
        {strength
          ? `Perkiraan kekuatan kata sandi: ${strength.label}`
          : current?.failed
            ? "Penilaian belum tersedia. Backup tetap dapat dibuat."
            : "Menilai kekuatan kata sandi…"}
      </Typography>
      {strength ? (
        <LinearProgress
          variant="determinate"
          value={strength.value}
          color={strength.color}
          aria-label={`Perkiraan kekuatan kata sandi: ${strength.label}`}
          sx={{ height: 6, borderRadius: 1 }}
        />
      ) : null}
    </Box>
  );
}
