"use client";

import { createContext, useContext } from "react";

const AuthenticatedUserContext = createContext(null);

/** Menyediakan identitas session terverifikasi kepada halaman client di dalam protected shell. */
export function AuthenticatedUserProvider({ user, children }) {
  return (
    <AuthenticatedUserContext.Provider value={user}>{children}</AuthenticatedUserContext.Provider>
  );
}

/** Mengambil user terautentikasi tanpa melakukan request session tambahan dari browser. */
export function useAuthenticatedUser() {
  const user = useContext(AuthenticatedUserContext);
  if (!user) throw new Error("useAuthenticatedUser harus digunakan di dalam ProtectedShell.");
  return user;
}
