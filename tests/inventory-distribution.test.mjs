import test from "node:test";
import assert from "node:assert/strict";
import {distributionSchema} from "../lib/inventory/distributionPolicy.mjs";
import {distributionWorkbook} from "../lib/inventory/distributionExport.mjs";
import ExcelJS from "exceljs";
test("filter distribusi menerima mode/detail periode dan menolak nilai tidak valid",()=>{
  assert.equal(distributionSchema.parse({organizationId:1}).view,"details");
  for(const value of [{from:"2026-10-13",to:"2026-10-01"},{warehouseId:0},{view:"unknown"},{pageSize:999},{status:"draft"}])assert.equal(distributionSchema.safeParse({organizationId:1,...value}).success,false);
});
test("workbook memakai teks literal dan mempertahankan presisi kuantitas besar",async()=>{
  const buffer=await distributionWorkbook({organization:{name:"Organisasi uji",timezone:"Asia/Makassar"},filters:{from:"2026-10-01",to:"2026-10-13",view:"summary",status:"all"},generatedAt:"2026-10-13T00:00:00Z",data:[{item_name:"=SUM(A1:A2)",warehouse_name:"Gudang",unit_name:"Buah",distributed_quantity:"999999999999999.999",returned_quantity:"0.000",net_quantity:"999999999999999.999"}]});
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);const sheet=workbook.getWorksheet("Distribusi");
  assert.equal(sheet.getRow(2).getCell(3).value,"=SUM(A1:A2)");assert.equal(sheet.getRow(2).getCell(3).type,ExcelJS.ValueType.String);
  assert.equal(sheet.getRow(2).getCell(7).value,"999999999999999.999");
});
