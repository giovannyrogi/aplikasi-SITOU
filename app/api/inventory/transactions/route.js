import { requirePermission, resolvePermissionOrganization } from "@/lib/auth/permissions";
import { getRequestId, handleRouteError, successResponse, readJson, validateMutationRequest, errorResponse } from "@/lib/api/routeHelpers";
import { transactionSchema } from "@/lib/inventory/transactionSchemas";
import { listTransactions, postTransaction, transactionOptions, transactionRecipients } from "@/lib/inventory/transactionService";
import { parseMultipartToPrivateTemp } from "@/lib/api/multipart";
import { z } from "zod";

const positive = (value) => value && /^[1-9]\d*$/.test(value) ? value : null;

export async function GET(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.transactions.read");
  if (response) return response;
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("organizationId") && !positive(url.searchParams.get("organizationId")))
      return errorResponse("INVALID_ORGANIZATION","Pilih organisasi yang valid.",400,requestId);
    const organizationId = resolvePermissionOrganization(user,url.searchParams.get("organizationId"));
    const warehouseId = url.searchParams.get("warehouseId");
    if (warehouseId && !positive(warehouseId)) return errorResponse("INVALID_WAREHOUSE","Pilih gudang yang valid.",400,requestId);
    if (url.searchParams.get("options") === "1") {
      const itemSearch = (url.searchParams.get("itemSearch") || "").trim();
      const includeItemIds = (url.searchParams.get("includeItemIds") || "").split(",").filter(Boolean);
      if (itemSearch.length>100 || includeItemIds.length>100 || includeItemIds.some((id)=>!positive(id)))
        return errorResponse("INVALID_ITEM_FILTER","Pilihan barang tidak valid.",400,requestId);
      return successResponse(await transactionOptions(organizationId,user,warehouseId,itemSearch,includeItemIds));
    }
    if (url.searchParams.get("recipients") === "1") {
      const locationId = positive(url.searchParams.get("locationId"));
      const unitId = positive(url.searchParams.get("unitId"));
      const occurredOn = url.searchParams.get("occurredOn");
      if (!warehouseId || !locationId || !unitId || !z.iso.date().safeParse(occurredOn).success) return errorResponse("INVALID_RECIPIENT_FILTER","Pilih gudang, tanggal, lokasi, dan Divisi & Unit dahulu.",400,requestId);
      return successResponse(await transactionRecipients(organizationId,user,{warehouseId,locationId,unitId,occurredOn}));
    }
    const kind = url.searchParams.get("kind") || "all";
    const status = url.searchParams.get("status") || "all";
    if (!["all","active","cancelled"].includes(status)) return errorResponse("INVALID_STATUS","Status transaksi tidak valid.",400,requestId);
    if (!["all","opening","receipt","issue","return","stocktake","reversal"].includes(kind)) return errorResponse("INVALID_KIND","Jenis transaksi tidak valid.",400,requestId);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const search = (url.searchParams.get("search") || "").trim();
    if (search.length > 100) return errorResponse("SEARCH_TOO_LONG","Pencarian maksimal 100 karakter.",400,requestId);
    const pageSize = Number(url.searchParams.get("pageSize") || 20);
    if (![10,20,50].includes(pageSize)) return errorResponse("INVALID_PAGE_SIZE","Jumlah data per halaman tidak valid.",400,requestId);
    if ([from,to].some((date) => date && !z.iso.date().safeParse(date).success)) return errorResponse("INVALID_DATE","Rentang tanggal tidak valid.",400,requestId);
    let cursorDate = null;
    let cursorId = null;
    if (url.searchParams.get("cursor")) {
      try {
        [cursorDate,cursorId] = JSON.parse(Buffer.from(url.searchParams.get("cursor"),"base64url").toString("utf8"));
        if (typeof cursorDate !== "string" || !Number.isFinite(Date.parse(cursorDate)) || !/^[0-9a-f-]{36}$/i.test(cursorId)) throw new Error("invalid");
      } catch { return errorResponse("INVALID_CURSOR","Muat ulang daftar transaksi.",400,requestId); }
    }
    return successResponse(await listTransactions(organizationId,user,{warehouseId,kind,status,from,to,cursorDate,cursorId,search,pageSize}));
  } catch(error) { return handleRouteError("inventory.transactions.list",error,requestId); }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const { user, response } = await requirePermission("inventory.transactions.create");
  if (response) return response;
  const rejected = await validateMutationRequest(request,user.id,requestId,{maxBytes:17*1024*1024});
  if (rejected) return rejected;
  let form = null;
  try {
    let payload;
    let uploads = [];
    if (request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
      form = await parseMultipartToPrivateTemp(request);
      const allowed = new Set(["payload","purchaseProof","requestDocument","handoverPhoto"]);
      for (const key of form.keys()) if (!allowed.has(key) || form.getAll(key).length !== 1)
        return errorResponse("INVALID_FORM_FIELD","Bagian formulir lampiran tidak valid.",400,requestId);
      const raw = form.get("payload");
      if (typeof raw !== "string" || Buffer.byteLength(raw,"utf8") > 128*1024)
        return errorResponse("INVALID_PAYLOAD","Data transaksi tidak valid atau terlalu besar.",400,requestId);
      let json;
      try { json=JSON.parse(raw); } catch {return errorResponse("INVALID_JSON","Data transaksi harus berupa JSON yang valid.",400,requestId);}
      const parsed = transactionSchema.safeParse(json);
      if (!parsed.success) {
        const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue)=>[issue.path.join(".") || "form",issue.message]));
        return errorResponse("VALIDATION_ERROR",parsed.error.issues[0].message,400,requestId,fieldErrors);
      }
      payload = parsed.data;
      uploads = [
        {key:"purchaseProof",purpose:"purchase_proof",fileKind:"inventory_purchase_proof"},
        {key:"requestDocument",purpose:"request_document",fileKind:"inventory_request_document"},
        {key:"handoverPhoto",purpose:"handover_photo",fileKind:"inventory_handover_photo"},
      ].filter((entry)=>form.get(entry.key)).map((entry)=>({...entry,file:form.get(entry.key)}));
    } else {
      const parsed = await readJson(request,transactionSchema,requestId);
      if (parsed.response) return parsed.response;
      payload = parsed.data;
    }
    const organizationId = resolvePermissionOrganization(user,payload.organizationId);
    const result = await postTransaction({...payload,organizationId},user,requestId,uploads);
    return successResponse(result,{status:201,message:"Transaksi berhasil dicatat. Stok gudang sudah diperbarui."});
  } catch(error) { return handleRouteError("inventory.transactions.post",error,requestId); }
  finally { await form?.cleanup?.(); }
}
