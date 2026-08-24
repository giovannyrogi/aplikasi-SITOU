export async function PATCH() {
  return Response.json({
    success: false,
    code: "ENDPOINT_MOVED",
    message: "Gunakan endpoint /api/access/accounts/:id/password untuk reset password.",
  }, { status: 410 });
}
