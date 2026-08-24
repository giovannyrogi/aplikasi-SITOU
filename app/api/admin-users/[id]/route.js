const deprecated = () => Response.json({
  success: false,
  code: "ENDPOINT_MOVED",
  message: "Gunakan endpoint /api/access/accounts/:id untuk mengelola akun organisasi.",
}, { status: 410 });
export const GET = deprecated;
export const PATCH = deprecated;
export const DELETE = deprecated;
