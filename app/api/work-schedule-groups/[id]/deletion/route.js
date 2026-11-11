import { handleScheduleDeletion } from "@/lib/work-schedules/deletionHttp";

export const runtime = "nodejs";
export const GET = (request, context) => handleScheduleDeletion(request, context, "shift-group");
export const POST = GET;
