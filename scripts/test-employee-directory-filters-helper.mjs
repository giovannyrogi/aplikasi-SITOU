import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import ExcelJS from "exceljs";
import {employeeWithoutAssignmentSql} from "../lib/employees/completeness.js";
export async function verifyDirectoryFilters({db,req,expect,org,other,superadmin,actor,browser,base}) {
  const prefix=`QA_DIR_${randomUUID().slice(0,8)}`;
  const add=async(suffix,blood,status="active",organization=org.id)=> (await db.query(`INSERT INTO employees(organization_id,employee_no,full_name,blood_type,joined_date,employment_status,national_id)
    VALUES($1,$2,$2,$3,current_date-10,$4,$5) RETURNING id::text`,[organization,`${prefix}_${suffix}`,blood,status,(BigInt("0x"+randomUUID().replaceAll("-","").slice(0,16))%10000000000000000n).toString().padStart(16,"0")])).rows[0].id;
  const missing=await add("A","A"),future=await add("B","B","probation"),expired=await add("AB","AB"),placed=await add("O","O"),suspended=await add("SUSPENDED","A","suspended");
  await add("OTHER","A","active",other.id);
  for(const [id,start,end,type] of [[future,1,null,"primary"],[expired,-4,-1,"primary"],[placed,-4,null,"primary"],[missing,-4,null,"additional"]])
    await db.query(`INSERT INTO employee_assignments(organization_id,employee_id,location_id,organization_unit_id,effective_from,effective_until,assignment_type)
      VALUES($1,$2,$3,$4,current_date+$5::int,CASE WHEN $6::int IS NULL THEN NULL ELSE current_date+$6::int END,$7)`,[org.id,id,org.locations[0],org.unit,start,end,type]);
  const filterUrl=`/api/employees?organizationId=${org.id}&search=${prefix}&pageSize=100`;
  for(const [blood,expected] of [["A",[missing,suspended]],["B",[future]],["AB",[expired]],["O",[placed]]]) {
    const result=expect(await req(`${filterUrl}&bloodType=${blood}`,superadmin.cookie),200);
    assert.deepEqual(result.map((r)=>r.id).sort(),expected.sort());
  }
  const missingRows=expect(await req(`${filterUrl}&completeness=without_assignment`,superadmin.cookie),200);
  assert.deepEqual(missingRows.map((r)=>r.id).sort(),[missing,future,expired].sort());
  assert.deepEqual(expect(await req(`${filterUrl}&completeness=without_assignment&bloodType=A`,superadmin.cookie),200).map((r)=>r.id),[missing]);
  const invalid=await req(`${filterUrl}&bloodType=INVALID`,superadmin.cookie);assert.equal(invalid.status,400);assert.ok(invalid.fieldErrors.bloodType);
  const reader=await actor("hrd",org.id,`${prefix}_reader`);
  await db.query("INSERT INTO user_hris_access_settings(organization_id,membership_id) VALUES($1,$2)",[org.id,reader.membership]);
  await db.query("INSERT INTO user_hris_menu_grants(organization_id,membership_id,menu_code,access_level) VALUES($1,$2,'employees','read'),($1,$2,'master-employment-types','read')",[org.id,reader.membership]);
  const allMissing=await req(`/api/employees?organizationId=${org.id}&completeness=without_assignment&pageSize=100`,reader.cookie);expect(allMissing,200);
  const dashboard=expect(await req(`/api/dashboard/summary?organizationId=${org.id}`,reader.cookie),200);
  assert.equal(dashboard.metrics.find((r)=>r.key==="withoutAssignment").value,allMissing.pagination.total);
  const plan=await db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT employee.id FROM employees employee WHERE organization_id=$1 AND deleted_at IS NULL AND blood_type=$2 AND ${employeeWithoutAssignmentSql("employee")}`,[org.id,"A"]);
  assert.ok(Number.isFinite(plan.rows[0]["QUERY PLAN"][0]["Execution Time"]));
  const context=await browser.newContext({viewport:{width:1366,height:950}});
  try {
    await context.addCookies([{name:"sitou_session",value:reader.cookie.split("=")[1],url:base}]);const page=await context.newPage();
    await page.goto(`${base}/employees`);await page.getByPlaceholder("Nama atau NIP").fill(prefix);
    await page.getByRole("combobox",{name:"Golongan darah",exact:true}).click();
    await page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").filter({hasText:/^A$/}).click();
    await page.getByRole("combobox",{name:"Kelengkapan data",exact:true}).click();
    await page.locator(".ant-select-dropdown:visible .ant-select-item-option-content").filter({hasText:/^Tanpa penempatan$/}).click();
    await page.getByText(`${prefix}_A`,{exact:true}).first().waitFor();
    for(const width of [320,768,1366]){await page.setViewportSize({width,height:950});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  }finally{await context.close();}
  await db.query("UPDATE user_organization_roles SET location_scope_mode='selected' WHERE id=$1",[reader.membership]);
  await db.query("INSERT INTO user_location_scopes(organization_id,user_organization_role_id,location_id) VALUES($1,$2,$3)",[org.id,reader.membership,org.locations[0]]);
  assert.equal(expect(await req(`${filterUrl}&completeness=without_assignment`,reader.cookie),200).length,0);
  assert.deepEqual(expect(await req(`${filterUrl}&bloodType=O`,reader.cookie),200).map((r)=>r.id),[placed]);
  expect(await req(filterUrl.replace(`organizationId=${org.id}`,`organizationId=${other.id}`),reader.cookie),403);
  const exportResponse=await fetch(`${base}/api/employees/export?organizationId=${org.id}&search=${prefix}&bloodType=B&completeness=without_assignment`,{headers:{Cookie:superadmin.cookie,Origin:base}});
  assert.equal(exportResponse.status,200);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
  const summary=workbook.getWorksheet("Ringkasan");assert.equal(summary.rowCount,2);assert.ok(summary.getRow(2).values.includes(`${prefix}_B`));
  const guide=[];workbook.getWorksheet("Petunjuk").eachRow((r)=>guide.push(...r.values));assert.ok(guide.includes("Golongan darah"));assert.ok(guide.includes("Tanpa penempatan"));
  console.log("PASS filter Pegawai: A/B/AB/O, tanpa penempatan sama dengan Dashboard, penempatan berlaku/lampau/mendatang/tambahan, scope/organisasi, export, query plan dan UI 320/768/1366.");
}
