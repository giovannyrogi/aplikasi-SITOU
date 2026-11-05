import { z } from "zod";
import { requireRole } from "@/app/utils/auth";
import {
  errorResponse,
  getRequestId,
  readBoundedRequestText,
  readJson,
  successResponse,
  validateMutationRequest,
} from "@/lib/api/routeHelpers";

const inputSchema = z.union([
  z.object({ query: z.string().trim().min(3).max(120) }).strict(),
  z
    .object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
    .strict(),
]);

function formatResult(feature) {
  if (feature?.geometry?.type !== "Point") return null;
  const [longitude, latitude] = feature.geometry.coordinates ?? [];
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  const p = feature.properties ?? {};
  const street = [p.street, p.housenumber].filter((value) => typeof value === "string").join(" ");
  const parts = [p.name, street, p.district, p.city, p.county, p.state, p.postcode, p.country]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());
  const address = [...new Set(parts)].join(", ").slice(0, 1000);
  return address ? { latitude, longitude, address } : null;
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requireRole(["superadmin", "hrd"]);
  if (response) return response;
  const rejected = await validateMutationRequest(request, user.id, requestId, {
    maxBytes: 1024,
    maxRequests: 30,
    windowMs: 60000,
  });
  if (rejected) return rejected;
  const { data, response: invalid } = await readJson(request, inputSchema, requestId);
  if (invalid) return invalid;
  const search = "query" in data;
  const url = new URL(search ? "/api/" : "/reverse", "https://photon.komoot.io");
  const params = search
    ? { q: data.query, limit: "5" }
    : {
        lat: data.latitude.toFixed(6),
        lon: data.longitude.toFixed(6),
        limit: "1",
      };
  url.search = new URLSearchParams(params);
  try {
    const upstream = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(5000)]),
      headers: { Accept: "application/json", "User-Agent": "SITOU-Dashboard/1.0" },
      cache: "no-store",
    });
    if (!upstream.ok) throw new Error("Geocoder unavailable");
    const body = JSON.parse(await readBoundedRequestText(upstream, 65536));
    const features = Array.isArray(body.features) ? body.features : [];
    return successResponse(
      features
        .slice(0, search ? 5 : 1)
        .map(formatResult)
        .filter(Boolean),
    );
  } catch {
    return errorResponse(
      "GEOCODER_UNAVAILABLE",
      "Layanan alamat belum tersedia. Anda dapat mengisi lokasi secara manual.",
      503,
      requestId,
    );
  }
}
