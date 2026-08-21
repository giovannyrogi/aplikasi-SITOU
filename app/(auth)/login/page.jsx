"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";
import axios from "axios";
import Notification from "@/app/components/Notifications/Notification";
import FontStyle from "@/app/components/font-style/FontStyle";
import AppCopyrightFooter from "@/app/components/footer/AppCopyrightFooter";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";
import AppLogo from "@/app/components/branding/AppLogo";

const APP_VERSION = "v0.1.0";
const statisticBadges = ["Multi Organisasi", "Manajemen SDM", "Realtime"];

function BuildingIllustration() {
  const theme = useTheme();

  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "relative",
        width: { xs: 250, sm: 330, lg: 390 },
        height: { xs: 210, sm: 280, lg: 330 },
        mx: "auto",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          left: "6%",
          bottom: "21%",
          width: "43%",
          height: "58%",
          borderRadius: "7px",
          bgcolor: theme.ui.login.illustrationLayer,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          left: "26%",
          bottom: "21%",
          width: "33%",
          height: "70%",
          borderRadius: "7px",
          bgcolor: theme.ui.login.illustrationLayerStrong,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: "6%",
          bottom: "21%",
          width: "42%",
          height: "64%",
          borderRadius: "7px",
          bgcolor: theme.ui.login.illustrationLayer,
        }}
      />

      {[0, 1, 2, 3, 4, 5].map((item) => (
        <Box
          key={item}
          sx={{
            position: "absolute",
            top: `${22 + Math.floor(item / 2) * 20}%`,
            left: `${18 + (item % 2) * 14 + (item > 3 ? 49 : 0)}%`,
            width: { xs: 18, sm: 25, lg: 30 },
            height: { xs: 25, sm: 35, lg: 40 },
            borderRadius: "4px",
            bgcolor: theme.ui.login.illustrationWindow,
          }}
        />
      ))}

      <Box
        sx={{
          position: "absolute",
          left: "25%",
          right: "25%",
          bottom: "20%",
          height: 9,
          borderRadius: 999,
          bgcolor: theme.ui.login.illustrationBase,
        }}
      />

      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: "23%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "flex-end",
          gap: { xs: 0.8, sm: 1.1 },
        }}
      >
        {[48, 70, 48].map((height, index) => (
          <Box
            key={height + index}
            sx={{
              width: { xs: index === 1 ? 44 : 34, sm: index === 1 ? 54 : 43 },
              height: { xs: height, sm: height + 14 },
              borderRadius: "16px 16px 8px 8px",
              bgcolor: theme.brand.onPrimary,
              position: "relative",
              "&::before": {
                content: '""',
                position: "absolute",
                top: { xs: -33, sm: -39 },
                left: "50%",
                width: { xs: index === 1 ? 47 : 42, sm: index === 1 ? 54 : 48 },
                height: { xs: index === 1 ? 47 : 42, sm: index === 1 ? 54 : 48 },
                borderRadius: "50%",
                bgcolor: theme.brand.onPrimary,
                transform: "translateX(-50%)",
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const theme = useTheme();
  const { isLoading, startNavigationLoading, finishNavigationLoading } = useLoadingBackdrop();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    finishNavigationLoading();
  }, [finishNavigationLoading]);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setNotification({
        open: true,
        message: "Username dan password wajib diisi.",
        severity: "warning",
      });
      return;
    }

    startNavigationLoading({ message: "Memproses login..." });

    try {
      const response = await axios.post("/api/auth/login", {
        username: username.trim(),
        password,
      });

      setNotification({
        open: true,
        message: response.data?.message || "Login berhasil. Anda akan diarahkan ke dashboard.",
        severity: "success",
      });

      startNavigationLoading({ message: "Membuka halaman tujuan..." });
      router.push(response.data?.redirectTo || "/dashboard");
    } catch (error) {
      finishNavigationLoading();
      setNotification({
        open: true,
        message:
          error.response?.data?.message || "Login gagal. Periksa kembali username dan password.",
        severity: "error",
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(430px, 0.95fr)" },
        bgcolor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      <Box
        component="section"
        sx={{
          minHeight: { xs: "auto", md: "100dvh" },
          px: { xs: 3, sm: 5, lg: 6 },
          py: { xs: 3, sm: 4, lg: 5.5 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: { xs: 4, md: 5 },
          color: theme.brand.onPrimary,
          position: "relative",
          overflow: "hidden",
          background: theme.ui.login.panelBackground,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: "-18% -8% -20% -18%",
            background: theme.ui.login.patternBackground,
            opacity: 0.55,
          }}
        />

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.4,
          }}
        >
          <Box
            sx={{
              width: { xs: 42, md: 46 },
              height: { xs: 42, md: 46 },
              borderRadius: "12px",
              bgcolor: theme.brand.onPrimary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <AppLogo variant="mark" width={40} height={40} priority />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <FontStyle fontSize={23} fontWeight={700} sx={{ lineHeight: 1 }}>
              SITOU
            </FontStyle>
            <FontStyle fontSize={11.5} fontWeight={500} sx={{ mt: 0.35 }}>
              by Perumda Pasar Manado
            </FontStyle>
          </Box>
        </Box>

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            my: { xs: 1, md: 0 },
          }}
        >
          <BuildingIllustration />
        </Box>

        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 430 }}>
          <FontStyle
            component="h1"
            fontWeight={700}
            sx={{
              fontSize: { xs: 30, sm: 34, lg: 38 },
              lineHeight: 1.12,
            }}
          >
            Sistem Informasi
            <br />
            Tenaga Operasional Unit
          </FontStyle>
          <FontStyle
            fontSize={14.5}
            fontWeight={500}
            sx={{
              mt: 2,
              maxWidth: 315,
              lineHeight: 1.65,
            }}
          >
            Platform terpadu pengelolaan SDM multi-organisasi milik Perumda Pasar Manado - cepat,
            aman, dan efisien.
          </FontStyle>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.4,
              mt: 2.5,
            }}
          >
            {statisticBadges.map((badge) => (
              <Box
                key={badge}
                sx={{
                  px: 1.45,
                  py: 0.85,
                  borderRadius: "10px",
                  bgcolor: theme.ui.login.statisticBadgeBg,
                  fontSize: 12,
                  lineHeight: 1,
                  fontWeight: 700,
                }}
              >
                {badge}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          minHeight: "100dvh",
          px: { xs: 2.5, sm: 6, md: 7, lg: 10 },
          pt: { xs: 5, sm: 6, md: 4 },
          display: "flex",
          flexDirection: "column",
          position: "relative",
          bgcolor: theme.palette.background.default,
        }}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            handleLogin();
          }}
          sx={{
            width: "100%",
            maxWidth: { xs: 420, lg: 430 },
            mx: "auto",
            my: "auto",
            py: { xs: 3, md: 5 },
          }}
        >
          <Box align="center">
            <FontStyle component="h2" fontSize={25} fontWeight={700} sx={{ lineHeight: 1.25 }}>
              Selamat Datang
            </FontStyle>

            <FontStyle fontSize={13.5} fontWeight={500} sx={{ mb: 3.8, color: theme.ui.mutedText }}>
              Masuk ke akun SITOU Anda untuk melanjutkan.
            </FontStyle>
          </Box>

          <FontStyle
            component="label"
            htmlFor="username"
            fontSize={13}
            fontWeight={700}
            sx={{ display: "block", mb: 0.8 }}
          >
            Username
          </FontStyle>
          <TextField
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Masukkan username"
            autoComplete="username"
            fullWidth
            required
            disabled={isLoading}
            slotProps={{
              htmlInput: { maxLength: 100 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon icon="solar:user-linear" fontSize={20} color={theme.brand.iconMuted} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              mb: 2.1,
              "& .MuiOutlinedInput-root": {
                height: 40,
                borderRadius: "18px",
                bgcolor: theme.ui.fieldBg,
                color: theme.palette.text.primary,
                fontSize: 14,
                "& fieldset": { borderColor: theme.ui.border },
                "&:hover fieldset": { borderColor: theme.brand.primaryHover },
                "&.Mui-focused fieldset": { borderColor: theme.brand.primary, borderWidth: 1.5 },
              },
            }}
          />

          <FontStyle
            component="label"
            htmlFor="password"
            fontSize={13}
            fontWeight={700}
            sx={{ display: "block", mb: 0.8 }}
          >
            Password
          </FontStyle>
          <TextField
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Masukkan password"
            autoComplete="current-password"
            fullWidth
            required
            disabled={isLoading}
            slotProps={{
              htmlInput: { maxLength: 72 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon
                      icon="solar:lock-keyhole-linear"
                      fontSize={20}
                      color={theme.brand.iconMuted}
                    />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={isLoading}
                      edge="end"
                      sx={{ color: theme.brand.iconMuted }}
                    >
                      <Icon
                        icon={showPassword ? "solar:eye-linear" : "solar:eye-closed-linear"}
                        fontSize={19}
                      />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                height: 40,
                borderRadius: "18px",
                bgcolor: theme.ui.fieldBg,
                color: theme.palette.text.primary,
                fontSize: 14,
                "& fieldset": { borderColor: theme.ui.border },
                "&:hover fieldset": { borderColor: theme.brand.primaryHover },
                "&.Mui-focused fieldset": { borderColor: theme.brand.primary, borderWidth: 1.5 },
              },
            }}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 2,
              mt: 1.2,
              mb: 2.1,
            }}
          >
            <Link
              href="/forgot-password"
              underline="none"
              sx={{ color: theme.brand.primary, fontSize: 13, fontWeight: 700 }}
            >
              Lupa password?
            </Link>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{
              height: 38,
              borderRadius: "18px",
              bgcolor: theme.brand.primary,
              boxShadow: "none",
              fontSize: 14,
              fontWeight: 600,
              textTransform: "none",
              color: theme.brand.onPrimary,
              "&:hover": {
                bgcolor: theme.brand.primaryDark,
                boxShadow: theme.ui.login.buttonShadow,
              },
            }}
          >
            {isLoading ? "Memproses..." : "Masuk ke SITOU"}
          </Button>
        </Box>

        <AppCopyrightFooter
          appName="SITOU"
          version={APP_VERSION}
          sx={{ mt: "auto", px: 0, pt: 2, pb: { xs: 2, sm: 2.5, md: 3 } }}
        />
      </Box>

      <Notification
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={() => setNotification((value) => ({ ...value, open: false }))}
      />
    </Box>
  );
}
