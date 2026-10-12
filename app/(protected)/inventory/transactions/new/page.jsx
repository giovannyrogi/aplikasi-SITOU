import { redirect } from "next/navigation";
export default async function Page({searchParams}) {
  const query=await searchParams;
  const params=new URLSearchParams();
  if(query.organizationId && /^[1-9]\d*$/.test(String(query.organizationId)))params.set("organizationId",String(query.organizationId));
  if(query.draftId && /^[0-9a-f-]{36}$/i.test(String(query.draftId)))params.set("draftId",String(query.draftId));
  redirect(`/inventory/transactions?${params}`);
}
