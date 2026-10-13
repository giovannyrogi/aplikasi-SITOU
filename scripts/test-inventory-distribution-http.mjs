import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {spawn} from "node:child_process";
import path from "node:path";
import os from "node:os";
import {pathToFileURL} from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import {createSessionToken} from "../lib/auth/session.js";
import {verifyDistribution} from "./test-inventory-distribution-helper.mjs";
dotenv.config({path:".env.development",quiet:true});
const databaseName=`sitou_distribution_test_${randomUUID().replaceAll("-","").slice(0,12)}`;
const base="http://127.0.0.1:3004";
const admin=new pg.Client({database:process.env.PGADMIN_DATABASE||"postgres"});
let db,server,browser,created=false;
const req=async(route,cookie,method="GET",body)=>{const response=await fetch(base+route,{method,headers:{Cookie:cookie,Origin:base,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};};
const expect=(result,status)=>{assert.equal(result.status,status,result.message);return result.data;};
try {
  await admin.connect();await admin.query(`CREATE DATABASE "${databaseName}"`);created=true;
  db=new pg.Pool({database:databaseName});await db.query(await readFile("sitou_schema_v3.sql","utf8"));
  const organizations=[];
  for(let i=0;i<2;i++) {
    const id=(await db.query("INSERT INTO organizations(code,name) VALUES($1,$2) RETURNING id::text",[`DIR_${i}`,`Organisasi uji filter ${i}`])).rows[0].id;
    await db.query("INSERT INTO organization_subscriptions(organization_id,starts_on,ends_on,status) VALUES($1,current_date-10,current_date+365,'active')",[id]);
    const location=(await db.query("INSERT INTO locations(organization_id,code,name,operational_from) VALUES($1,'PUSAT','Pusat',current_date-10) RETURNING id::text",[id])).rows[0].id;
    const type=(await db.query("INSERT INTO organization_unit_types(organization_id,code,name) VALUES($1,'DIV','Divisi') RETURNING id",[id])).rows[0].id;
    const unit=(await db.query("INSERT INTO organization_units(organization_id,code,name,unit_type_id) VALUES($1,'UNIT','Unit umum',$2) RETURNING id",[id,type])).rows[0].id;
    await db.query("INSERT INTO organization_unit_locations(organization_id,organization_unit_id,location_id,active_from) VALUES($1,$2,$3,current_date-10)",[id,unit,location]);
    organizations.push({id,locations:[location],unit});
  }
  const actor=async(role,organization=null,username=role)=>{
    const id=(await db.query("INSERT INTO users(username,password_hash) VALUES($1,'test-not-used') RETURNING id::text",[username])).rows[0].id;
    const membership=(await db.query("INSERT INTO user_organization_roles(user_id,organization_id,role_id,location_scope_mode) SELECT $1,$2,id,'all' FROM roles WHERE code=$3 RETURNING id::text",[id,organization,role])).rows[0].id;
    const token=await createSessionToken({userId:id,roleCode:role,organizationId:organization,credentialVersion:1,expiresAt:Date.now()+600000});return {id,membership,cookie:`sitou_session=${token}`};
  };
  const superadmin=await actor("superadmin");
  server=spawn(process.execPath,["-r","dotenv/config","node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3004"],{windowsHide:true,stdio:["ignore","pipe","pipe"],env:{...process.env,PGDATABASE:databaseName,NODE_ENV:"production",DOTENV_CONFIG_PATH:".env.development",APP_ORIGIN:base}});
  server.stderr.on("data",(chunk)=>process.stderr.write(chunk));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Server uji belum siap")),20000);server.stdout.on("data",(chunk)=>{if(chunk.toString().includes("Ready")){clearTimeout(timer);resolve();}});server.once("exit",()=>{clearTimeout(timer);reject(Error("Server uji berhenti"));});});
  const {chromium}=await import(pathToFileURL(path.join(os.homedir(),".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs")).href);
  browser=await chromium.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
  await verifyDistribution({db,req,expect,org:organizations[0],other:organizations[1],superadmin,actor,browser,base});
}finally {
  await browser?.close();server?.kill();await db?.end();
  if(created){await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",[databaseName]);await admin.query(`DROP DATABASE "${databaseName}"`);}
  await admin.end();
}
