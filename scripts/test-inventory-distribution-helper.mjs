import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import ExcelJS from "exceljs";
import {readDistribution,readDistributionTotals} from "../lib/inventory/distributionRepository.js";
export async function verifyDistribution({db,req,expect,org,other,superadmin,actor,browser,base}) {
  const today=(await db.query("SELECT to_char((now() AT TIME ZONE timezone)::date,'YYYY-MM-DD') AS today FROM organizations WHERE id=$1",[org.id])).rows[0].today;
  const ago=(d)=>new Date(Date.parse(`${today}T00:00:00Z`)-d*86400000).toISOString().slice(0,10);
  const seed=async(organization,code)=>{
    expect(await req("/api/access/modules",superadmin.cookie,"PATCH",{organizationId:Number(organization.id),isEnabled:true,version:0}),200);
    const warehouse=(await db.query("INSERT INTO inventory_warehouses(organization_id,location_id,code,name) VALUES($1,$2,$3,$4) RETURNING id::text",[organization.id,organization.locations[0],code,`Gudang ${code}`])).rows[0].id;
    const category=(await db.query("INSERT INTO inventory_categories(organization_id,code,name) VALUES($1,$2,'Kategori uji') RETURNING id",[organization.id,code])).rows[0].id;
    const unit=(await db.query("INSERT INTO inventory_units(organization_id,code,name,allows_fractional) VALUES($1,$2,'Buah',false) RETURNING id",[organization.id,code])).rows[0].id;
    const item=(await db.query("INSERT INTO inventory_items(organization_id,code,name,category_id,unit_id) VALUES($1,$2,$3,$4,$5) RETURNING id::text",[organization.id,code,`Barang ${code}`,category,unit])).rows[0].id;
    return {warehouse,item,unit,category};
  };
  const a=await seed(org,"UTAMA"),foreign=await seed(other,"LAIN");
  const warehouse2=(await db.query("INSERT INTO inventory_warehouses(organization_id,location_id,code,name) VALUES($1,$2,'KEDUA','Gudang Kedua') RETURNING id::text",[org.id,org.locations[0]])).rows[0].id;
  const unit2=(await db.query("INSERT INTO inventory_units(organization_id,code,name) VALUES($1,'RIM','Rim') RETURNING id",[org.id])).rows[0].id;
  const item2=(await db.query("INSERT INTO inventory_items(organization_id,code,name,category_id,unit_id) VALUES($1,'KERTAS','Kertas uji',$2,$3) RETURNING id::text",[org.id,a.category,unit2])).rows[0].id;
  const employee=(await db.query("INSERT INTO employees(organization_id,employee_no,full_name,national_id,joined_date,employment_status) VALUES($1,'UJI','Pegawai penerima uji','1111111111111111',current_date-15,'active') RETURNING id",[org.id])).rows[0].id;
  const tx=async(kind,date,warehouse,lines,{organization=org.id,source=null,reversal=null,memo=null}={})=>{
    const id=randomUUID();await db.query(`INSERT INTO inventory_transactions(id,organization_id,warehouse_id,kind,status,occurred_on,recorded_at,created_by_user_id,source_transaction_id,reversal_of_id,reference_no,destination_location_id,destination_unit_id,recipient_employee_id)
      VALUES($1,$2,$3,$4,'posted',$5,now(),$6,$7,$8,$9,$10,$11,$12)`,[id,organization,warehouse,kind,date,superadmin.id,source,reversal,memo,kind==="issue"?org.locations[0]:null,kind==="issue"&&organization===org.id?org.unit:null,kind==="issue"&&organization===org.id?employee:null]);
    const saved=[];for(const line of lines)saved.push((await db.query("INSERT INTO inventory_transaction_lines(organization_id,transaction_id,item_id,quantity,delta,source_line_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text",[organization,id,line.item,line.qty,kind==="issue"?-line.qty:line.qty,line.sourceLine||null])).rows[0].id);
    return {id,lines:saved};
  };
  const issue=await tx("issue",ago(8),a.warehouse,[{item:a.item,qty:5}],{memo:"MEMO-01"});
  const returned=await tx("return",ago(5),a.warehouse,[{item:a.item,qty:2,sourceLine:issue.lines[0]}],{source:issue.id});
  await tx("reversal",ago(2),a.warehouse,[{item:a.item,qty:2}],{reversal:returned.id});
  await tx("reversal",ago(1),a.warehouse,[{item:a.item,qty:5}],{reversal:issue.id});
  const active=await tx("issue",ago(4),a.warehouse,[{item:a.item,qty:3},{item:item2,qty:6}],{memo:"=MEMO-LITERAL"});
  await tx("issue",ago(4),warehouse2,[{item:a.item,qty:7}]);
  // Foreign location must remain inside its own organization.
  const foreignId=randomUUID();await db.query("INSERT INTO inventory_transactions(id,organization_id,warehouse_id,kind,status,occurred_on,recorded_at,created_by_user_id,destination_location_id,destination_unit_id) VALUES($1,$2,$3,'issue','posted',$4,now(),$5,$6,$7)",[foreignId,other.id,foreign.warehouse,ago(4),superadmin.id,other.locations[0],other.unit]);
  await db.query("INSERT INTO inventory_transaction_lines(organization_id,transaction_id,item_id,quantity,delta) VALUES($1,$2,$3,9,-9)",[other.id,foreignId,foreign.item]);
  const reader=await actor("hrd",org.id,"report_reader"),master=await actor("hrd",org.id,"report_master"),none=await actor("hrd",org.id,"report_none");
  const grant=(who,code,warehouse)=>db.query(`WITH granted AS (INSERT INTO user_access_packages(organization_id,membership_id,package_code,scope_mode) VALUES($1,$2,$3,'selected') RETURNING id)
    INSERT INTO user_package_warehouse_scopes(organization_id,grant_id,warehouse_id) SELECT $1,id,$4 FROM granted`,[org.id,who.membership,code,warehouse]);
  await grant(reader,"inventory_reader",a.warehouse);
  await db.query("INSERT INTO user_access_packages(organization_id,membership_id,package_code,scope_mode) VALUES($1,$2,'inventory_master','all')",[org.id,master.membership]);
  const root=`/api/inventory/distribution?organizationId=${org.id}&from=${ago(10)}`;
  for(const [end,q,back,net] of [[ago(6),"5.000","0.000","5.000"],[ago(3),"5.000","2.000","3.000"],[ago(1),"0.000","0.000","0.000"]]) {
    const report=expect(await req(`${root}&to=${end}&status=all&search=MEMO-01`,reader.cookie),200);assert.equal(report.total,1);
    assert.equal(report.data[0].distributed_quantity,q);assert.equal(report.data[0].returned_quantity,back);assert.equal(report.data[0].net_quantity,net);
  }
  const current=expect(await req(`${root}&to=${today}`,reader.cookie),200);assert.equal(current.total,2);assert.equal(current.metrics.transactions,1);assert.equal(current.metrics.items,2);
  assert.ok(current.data.every((r)=>r.warehouse_id===a.warehouse));
  const cancelled=expect(await req(`${root}&to=${today}&status=cancelled`,reader.cookie),200);assert.equal(cancelled.total,1);assert.equal(cancelled.data[0].original_quantity,"5.000");
  const summary=expect(await req(`${root}&to=${today}&view=summary`,reader.cookie),200);assert.equal(summary.total,2);assert.deepEqual(summary.data.map((r)=>r.unit_name).sort(),["Buah","Rim"]);
  for(const cookie of [master.cookie,none.cookie])expect(await req(`${root}&to=${today}`,cookie),403);
  expect(await req(`${root}&to=${today}&warehouseId=${warehouse2}`,reader.cookie),403);
  expect(await req(`${root.replace(`organizationId=${org.id}`,`organizationId=${other.id}`)}&to=${today}`,reader.cookie),403);
  const options=expect(await req(`/api/inventory/distribution?organizationId=${org.id}&options=1`,reader.cookie),200);assert.equal(options.warehouses.length,1);assert.equal(options.recipients[0].label,"Pegawai penerima uji");
  const bad=await req(`${root}&to=${ago(12)}`,reader.cookie);assert.equal(bad.status,400);assert.ok(bad.fieldErrors.to);
  expect(await req(`${root}&to=${today}&cursor=invalid`,reader.cookie),400);
  const exportResponse=await fetch(`${base}${root}&to=${today}&export=xlsx`,{headers:{Cookie:reader.cookie,Origin:base}});assert.equal(exportResponse.status,200);assert.equal(exportResponse.headers.get("cache-control"),"private, no-store");
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));assert.equal(workbook.getWorksheet("Distribusi").rowCount,3);
  const memoCell=workbook.getWorksheet("Distribusi").getRow(2).getCell(8);assert.equal(memoCell.value,"=MEMO-LITERAL");assert.equal(memoCell.type,ExcelJS.ValueType.String);
  assert.equal((await db.query("SELECT count(*)::int count FROM audit_logs WHERE organization_id=$1 AND action='inventory.distribution.export'",[org.id])).rows[0].count,1);
  const planDb={query:(sql,values)=>db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`,values)};
  const parsed={organizationId:org.id,from:ago(10),to:today,status:"all",view:"details",search:"",pageSize:20};
  const plan=await readDistribution(planDb,parsed,[a.warehouse]);assert.ok(Number.isFinite(plan[0]["QUERY PLAN"][0]["Execution Time"]));await readDistributionTotals(planDb,parsed,[a.warehouse]);
  const context=await browser.newContext({viewport:{width:1366,height:950}});
  try {await context.addCookies([{name:"sitou_session",value:reader.cookie.split("=")[1],url:base}]);const page=await context.newPage();await page.goto(`${base}/reports/inventory-distribution`);
    await page.getByText("Rincian penyaluran",{exact:true}).last().waitFor();await page.getByRole("button",{name:/Lihat detail penyaluran/}).first().waitFor();
    for(const width of [320,375,768,1024,1366,1920]){await page.setViewportSize({width,height:950});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);}
    const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export",exact:true}).click();
    assert.equal(await page.getByText("Unduh PDF",{exact:true}).count(),0);
    await page.getByText("Unduh Excel",{exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/^sitou-distribusi-/);
    await page.getByRole("button",{name:/Lihat detail penyaluran/}).first().click();const modal=page.getByRole("dialog",{name:"Barang keluar",exact:true});await modal.getByText("Pegawai penerima uji",{exact:true}).waitFor();assert.equal(await modal.getByRole("button",{name:"Batalkan transaksi",exact:true}).count(),0);await modal.getByRole("button",{name:"Tutup",exact:true}).click();
    await page.getByRole("combobox",{name:"Tampilan laporan",exact:true}).click();await page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").filter({hasText:/^Rekap barang dan unit$/}).click();await page.getByRole("button",{name:"Lihat penyaluran",exact:true}).first().waitFor();
    await page.getByRole("button",{name:"Lihat penyaluran",exact:true}).first().click();await page.getByRole("button",{name:/Lihat detail penyaluran/}).first().waitFor();
  }finally{await context.close();}
  // Keyset pagination cannot be reused after filters change.
  await db.query(`WITH docs AS (INSERT INTO inventory_transactions(id,organization_id,warehouse_id,kind,status,occurred_on,recorded_at,created_by_user_id,destination_location_id,destination_unit_id,recipient_employee_id,reference_no)
    SELECT gen_random_uuid(),$1,$2,'issue','posted',$3::date,now(),$4,$5,$6,$7,'PAGE_'||n FROM generate_series(1,25) n RETURNING id)
    INSERT INTO inventory_transaction_lines(organization_id,transaction_id,item_id,quantity,delta) SELECT $1,id,$8,1,-1 FROM docs`,[org.id,a.warehouse,ago(4),superadmin.id,org.locations[0],org.unit,employee,a.item]);
  const firstPage=expect(await req(`${root}&to=${today}&pageSize=10`,reader.cookie),200);assert.equal(firstPage.total,27);assert.ok(firstPage.nextCursor);
  const secondPage=expect(await req(`${root}&to=${today}&pageSize=10&cursor=${firstPage.nextCursor}`,reader.cookie),200);assert.equal(secondPage.total,27);assert.ok(secondPage.data.every((r)=>!firstPage.data.some((old)=>old.id===r.id)));
  expect(await req(`${root}&to=${today}&status=all&pageSize=10&cursor=${firstPage.nextCursor}`,reader.cookie),400);
  await db.query("INSERT INTO user_access_packages(organization_id,membership_id,package_code,scope_mode) VALUES($1,$2,'inventory_master','all')",[org.id,reader.membership]);
  assert.equal(expect(await req(`${root}&to=${today}`,reader.cookie),200).total,27,"Grant master seluruh organisasi tidak memperluas scope laporan");
  const alternate=(await db.query("INSERT INTO locations(organization_id,code,name,operational_from) VALUES($1,'ALT','Lokasi baru',current_date-10) RETURNING id",[org.id])).rows[0].id;
  await db.query("INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from) VALUES($1,$2,$3,$4,current_date-1)",[org.id,employee,alternate,org.unit]);
  const historical=expect(await req(`${root}&to=${today}&search=MEMO-01&status=all`,reader.cookie),200);assert.equal(historical.data[0].location_id,org.locations[0]);
  // A separate report-only permission cannot open full transaction details.
  const reportsOnly=await actor("hrd",org.id,"reports_only");
  await db.query("INSERT INTO access_packages(code,module_code,name) VALUES('report_test','inventory','Report test')");
  await db.query("INSERT INTO access_package_permissions(package_code,permission_id) SELECT 'report_test',id FROM permissions WHERE code='inventory.reports.read'");
  await grant(reportsOnly,"report_test",a.warehouse);
  assert.ok(expect(await req(`${root}&to=${today}`,reportsOnly.cookie),200).data.every((r)=>!r.canReadTransaction));
  expect(await req(`/api/inventory/transactions/${active.id}?organizationId=${org.id}`,reportsOnly.cookie),403);
  // Export limit is checked before writing a partial workbook.
  await db.query(`WITH docs AS (INSERT INTO inventory_transactions(id,organization_id,warehouse_id,kind,status,occurred_on,recorded_at,created_by_user_id,destination_location_id,destination_unit_id,recipient_employee_id,reference_no)
    SELECT gen_random_uuid(),$1,$2,'issue','posted',$3::date,now(),$4,$5,$6,$7,'BULK' FROM generate_series(1,5001) n RETURNING id)
    INSERT INTO inventory_transaction_lines(organization_id,transaction_id,item_id,quantity,delta) SELECT $1,id,$8,1,-1 FROM docs`,[org.id,a.warehouse,ago(4),superadmin.id,org.locations[0],org.unit,employee,a.item]);
  const overflow=await req(`${root}&to=${today}&search=BULK&export=xlsx`,reader.cookie);assert.equal(overflow.code,"EXPORT_LIMIT_EXCEEDED");assert.ok(overflow.fieldErrors.from);
  await db.query("ANALYZE inventory_transactions");await db.query("ANALYZE inventory_transaction_lines");
  const largePlan=await readDistribution(planDb,parsed,[a.warehouse]);await readDistributionTotals(planDb,parsed,[a.warehouse]);
  console.log(`EXPLAIN distribusi 5.000+ baris: ${largePlan[0]["QUERY PLAN"][0]["Execution Time"]} ms.`);
  await db.query("UPDATE organization_modules SET is_enabled=false WHERE organization_id=$1 AND module_code='inventory'",[org.id]);expect(await req(`${root}&to=${today}`,reader.cookie),403);
  await db.query("UPDATE organization_modules SET is_enabled=true WHERE organization_id=$1 AND module_code='inventory'",[org.id]);
  assert.equal((await db.query("SELECT count(*)::int count FROM inventory_stock_balances")).rows[0].count,0);
  // Permission removal applies to the next request, using the same session.
  await db.query("UPDATE user_access_packages SET is_active=false WHERE membership_id=$1",[reader.membership]);expect(await req(`${root}&to=${today}`,reader.cookie),403);
  console.log("PASS Distribusi: periode historis/pengembalian/pembatalan, rekap satuan, scope/organisasi/pencabutan, export literal/audit, query plan, modal baca dan UI 320–1920. Stok tidak berubah.");
}
