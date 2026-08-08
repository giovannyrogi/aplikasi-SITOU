"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ThemeProvider } from "@mui/material/styles";
import { lightTheme, darkTheme } from "./ThemeProvider";

const ThemeModeContext = createContext();

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

export function ThemeModeProvider({ children }) {
  const [themeMode, setThemeMode] = useState("dark"); // default dark

  useEffect(() => {
    const currentTheme = localStorage.getItem("currentTheme");
    if (currentTheme) {
      const { currentThemeMode } = JSON.parse(currentTheme);
      setThemeMode(currentThemeMode);
    }
  }, []);

  const theme = useMemo(
    () => (themeMode === "dark" ? darkTheme : lightTheme),
    [themeMode]
  );

  const value = useMemo(() => ({ themeMode, setThemeMode }), [themeMode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
