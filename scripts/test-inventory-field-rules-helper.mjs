import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {transactionPresentations} from "../app/components/inventory/transactionPresentations.js";
import {transactionDocumentField} from "../lib/inventory/transactionFieldPolicy.mjs";
export async function verifyInventoryFieldRules({db,req,expect,org,superadmin,browser,base}) {
  const organizationId=Number(org.id),cookie=superadmin.cookie,transactions="/api/inventory/transactions";
  expect(await req("/api/access/modules",cookie,"PATCH",{organizationId,isEnabled:true,version:0}),200);
  const warehouse=expect(await req("/api/inventory/warehouses",cookie,"POST",{organizationId,locationId:Number(org.locations[0]),code:"UJI",name:"Gudang uji",isActive:true}),201);
  const baseCatalog={organizationId,code:"UJI",name:"Uji",isActive:true};
  const category=expect(await req("/api/inventory/catalog/categories",cookie,"POST",baseCatalog),201);
  const unit=expect(await req("/api/inventory/catalog/units",cookie,"POST",{...baseCatalog,name:"Buah",allowsFractional:false}),201);
  const items=[];
  for(let i=0;i<2;i++) {
    const item=expect(await req("/api/inventory/catalog/items",cookie,"POST",{...baseCatalog,code:`BARANG_${i}`,name:`Barang uji ${i}`,categoryId:Number(category.id),unitId:Number(unit.id)}),201);
    expect(await req(`/api/inventory/catalog/items/${item.id}/warehouses`,cookie,"PUT",{organizationId,warehouseId:Number(warehouse.id),minimumStock:0,isActive:true,version:0}),200);items.push(item);
  }
  const today=(await db.query("SELECT to_char((now() AT TIME ZONE timezone)::date,'YYYY-MM-DD') AS today FROM organizations WHERE id=$1",[org.id])).rows[0].today;
  const ago=(n)=>new Date(Date.parse(`${today}T00:00:00Z`)-n*86400000).toISOString().slice(0,10);
  const payload=(kind,changes={})=>({organizationId,transactionId:randomUUID(),warehouseId:Number(warehouse.id),kind,occurredOn:ago(1),lines:[{itemId:Number(items[0].id),quantity:1}],...changes});
  const opening=payload("opening",{occurredOn:ago(3),lines:[{itemId:Number(items[0].id),quantity:10}]});
  expect(await req(`${transactions}/preview`,cookie,"POST",opening),200);expect(await req(transactions,cookie,"POST",opening),201);
  const employee=(await db.query("INSERT INTO employees(organization_id,employee_no,full_name,national_id,joined_date,employment_status) VALUES($1,'UJI','Pegawai uji','1111111111111111',current_date-10,'active') RETURNING id",[org.id])).rows[0].id;
  await db.query("INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from) VALUES($1,$2,$3,$4,current_date-10)",[org.id,employee,org.locations[0],org.unit]);
  const destination={destinationLocationId:Number(org.locations[0]),destinationUnitId:Number(org.unit),recipientEmployeeId:Number(employee)};
  const issue=payload("issue",{...destination,lateReason:"Penyaluran baru dimasukkan ke sistem.",lines:[{itemId:Number(items[0].id),quantity:2}]});
  expect(await req(transactions,cookie,"POST",issue),201);
  for(const kind of ["receipt","issue","return","stocktake"]) {
    const input=payload(kind,kind==="issue"?destination:kind==="return"?{sourceTransactionId:issue.transactionId}:{});
    for(const route of [`${transactions}/preview`,transactions]) {
      const rejected=await req(route,cookie,"POST",input);assert.equal(rejected.code,"LATE_REASON_REQUIRED");assert.ok(rejected.fieldErrors.lateReason);
    }
    expect(await req(`${transactions}/preview`,cookie,"POST",{...input,lateReason:"Pencatatan kejadian sebelumnya baru diselesaikan."}),200);
    expect(await req(`${transactions}/preview`,cookie,"POST",{...input,occurredOn:today}),200);
  }
  const newOpening=payload("opening",{lines:[{itemId:Number(items[1].id),quantity:0}]});
  assert.equal((await req(`${transactions}/preview`,cookie,"POST",{...newOpening,occurredOn:ago(31)})).code,"TRANSACTION_DATE_TOO_OLD");
  assert.equal((await req(`${transactions}/preview`,cookie,"POST",{...newOpening,occurredOn:ago(-1)})).code,"TRANSACTION_DATE_FUTURE");
  const context=await browser.newContext({viewport:{width:1366,height:950}});
  try {
    await context.addCookies([{name:"sitou_session",value:cookie.split("=")[1],url:base}]);const page=await context.newPage();
    for(const kind of ["opening","receipt","issue","return","stocktake"]) {
      const input=payload(kind,{currentStep:1,referenceNo:["opening","return","stocktake"].includes(kind)?"DOKUMEN-LAMA-01":"",...(kind==="issue"?destination:kind==="return"?{sourceTransactionId:issue.transactionId}:{})});
      expect(await req(`${transactions}/drafts`,cookie,"POST",input),200);
      await page.goto(`${base}/inventory/transactions?organizationId=${org.id}`);await page.getByText("Tambah transaksi",{exact:true}).click();
      const dialog=page.getByRole("dialog",{name:transactionPresentations[kind].label,exact:true});await dialog.getByPlaceholder("Keterangan tambahan untuk riwayat transaksi").waitFor();
      const field=transactionDocumentField(kind);
      assert.equal(await dialog.locator('[data-field="referenceNo"] input').count(),field?1:0);
      if(kind==="return")await dialog.getByText("Draft aman tersimpan",{exact:true}).waitFor();
      if(kind!=="opening")await dialog.locator('[data-field="lateReason"] textarea').waitFor();
      assert.equal(await dialog.locator('[data-field="lateReason"] textarea').count(),kind==="opening"?0:1);
      if(kind==="return"){
        const details=dialog.getByRole("button",{name:"Lihat detail transaksi",exact:true});await details.waitFor();
        await page.waitForFunction(()=>[...document.querySelectorAll("button")].some((b)=>b.textContent.trim()==="Lihat detail transaksi"&&!b.disabled));
        await details.focus();await page.keyboard.press("Enter");
        const sourceDialog=page.getByRole("dialog",{name:"Detail transaksi penyaluran",exact:true});await sourceDialog.getByText("Pegawai uji",{exact:true}).waitFor();
        await sourceDialog.getByRole("button",{name:"Tutup",exact:true}).click();
        assert.equal(await dialog.getByPlaceholder("Keterangan tambahan untuk riwayat transaksi").inputValue(),"");
      }
      if(field)await dialog.getByRole("textbox",{name:field.label,exact:true}).fill(kind==="receipt"?"NOTA-01":"MEMO-01");
      else await dialog.getByText("DOKUMEN-LAMA-01",{exact:true}).waitFor();
      if(kind!=="opening")await dialog.locator('[data-field="lateReason"] textarea').fill("Pencatatan baru diselesaikan sekarang.");
      await dialog.getByPlaceholder("Keterangan tambahan untuk riwayat transaksi").fill("Catatan uji yang disimpan.");
      for(const width of [320,768,1366]){await page.setViewportSize({width,height:950});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);}
      await dialog.getByRole("button",{name:"Simpan draft & tutup",exact:true}).click();await dialog.waitFor({state:"hidden"});
      const saved=expect(await req(`${transactions}/${input.transactionId}?organizationId=${org.id}`,cookie),200);
      assert.equal(saved.draft_payload.referenceNo,field?kind==="receipt"?"NOTA-01":"MEMO-01":"DOKUMEN-LAMA-01");
      expect(await req(`${transactions}/${input.transactionId}/draft?organizationId=${org.id}`,cookie,"DELETE"),200);
    }
  }finally{await context.close();}
  const stocktake=payload("stocktake",{occurredOn:today,lines:[{itemId:Number(items[0].id),quantity:8}]});expect(await req(transactions,cookie,"POST",stocktake),201);
  expect(await req(`${transactions}/${stocktake.transactionId}/cancel`,cookie,"POST",{organizationId,reversalId:randomUUID(),reason:""}),400);
  const read=expect(await req(`/api/inventory/openings?organizationId=${org.id}&warehouseId=${warehouse.id}&itemId=${items[0].id}`,cookie),200);
  const correction={action:"preview",operationId:randomUUID(),organizationId,warehouseId:Number(warehouse.id),itemId:Number(items[0].id),correction:{occurredOn:ago(3),quantity:10,reason:"",version:read.version,fingerprint:read.fingerprint}};
  expect(await req("/api/inventory/openings",cookie,"POST",correction),400);
  console.log("PASS aturan field Inventaris: saldo awal tanpa alasan terlambat, empat operasi sebelumnya wajib alasan, hari ini bebas alasan, batas tanggal, dokumen penerimaan/memo, draft lama tetap utuh, alasan pembatalan/koreksi, UI 320/768/1366.");
}
