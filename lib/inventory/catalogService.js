import { randomUUID } from "node:crypto";
import pool from "@/lib/dbConfig";
import { withTransaction } from "@/lib/dbTransaction";
import { ServiceError } from "@/lib/api/routeHelpers";
import { writeAudit } from "@/lib/audit";
import { readPermissionScope } from "@/lib/access/packageRepository";
import { requireInventoryAccess } from "./service";
import {
  prepareEmployeeFileUpload,
  finalizePreparedEmployeeFile,
  insertPreparedEmployeeFile,
  discardPreparedEmployeeFile,
  stageStoredFilesForDeletion,
} from "@/lib/files/storage";
const TABLES = {
  items: "inventory_items",
  categories: "inventory_categories",
  units: "inventory_units",
};
export function assertCatalogKind(kind) {
  if (!Object.hasOwn(TABLES, kind))
    throw new ServiceError("NOT_FOUND", "Jenis katalog tidak tersedia.", 404);
}
export async function assertCatalogWrite(actor, org, permission, database = pool) {
  await requireInventoryAccess(actor, org, permission, null, database);
}
const fields = (kind) =>
  kind === "items"
    ? `entry.id::text,entry.code,entry.name,entry.notes,entry.is_active,entry.version,entry.category_id::text,entry.unit_id::text,entry.photo_file_id::text,category.name AS category_name,unit.name AS unit_name,unit.allows_fractional,
 photo.original_name AS photo_name,photo.mime_type AS photo_mime,photo.size_bytes AS photo_size,
 EXISTS(SELECT 1 FROM inventory_item_warehouses linked WHERE linked.organization_id=entry.organization_id AND linked.item_id=entry.id) AS unit_locked`
    : `entry.id::text,entry.code,entry.name,entry.notes,entry.is_active,entry.version${kind === "units" ? ",entry.allows_fractional,EXISTS(SELECT 1 FROM inventory_items used WHERE used.organization_id=entry.organization_id AND used.unit_id=entry.id) AS quantity_locked" : ""}`;
const joins = (kind) =>
  kind === "items"
    ? `JOIN inventory_categories category ON category.organization_id=entry.organization_id AND category.id=entry.category_id JOIN inventory_units unit ON unit.organization_id=entry.organization_id AND unit.id=entry.unit_id LEFT JOIN stored_files photo ON photo.organization_id=entry.organization_id AND photo.id=entry.photo_file_id`
    : "";
export async function listCatalog(kind, input, actor) {
  assertCatalogKind(kind);
  await requireInventoryAccess(actor, input.organizationId, "inventory.catalog.read");
  const params = [input.organizationId, input.search ? `%${input.search}%` : "", input.status];
  const where = `FROM ${TABLES[kind]} entry ${joins(kind)} WHERE entry.organization_id=$1 AND ($2='' OR entry.name ILIKE $2 OR entry.code ILIKE $2) AND ($3='all' OR entry.is_active=($3='active'))`;
  const [rows, count, scope] = await Promise.all([
    pool.query(`SELECT ${fields(kind)} ${where} ORDER BY entry.name,entry.id LIMIT $4 OFFSET $5`, [
      ...params,
      input.pageSize,
      (input.page - 1) * input.pageSize,
    ]),
    pool.query(`SELECT count(*)::int total ${where}`, params),
    readPermissionScope(actor, input.organizationId, "inventory.catalog.update"),
  ]);
  return {
    data: rows.rows,
    total: count.rows[0].total,
    canManage: scope === null || scope.length > 0,
  };
}
export async function catalogOptions(org, actor) {
  await requireInventoryAccess(actor, org, "inventory.catalog.read");
  const [categories, units, read, edit] = await Promise.all([
    pool.query(
      "SELECT id::text,name,is_active FROM inventory_categories WHERE organization_id=$1 ORDER BY name",
      [org],
    ),
    pool.query(
      "SELECT id::text,name,is_active,allows_fractional FROM inventory_units WHERE organization_id=$1 ORDER BY name",
      [org],
    ),
    readPermissionScope(actor, org, "inventory.warehouses.read"),
    readPermissionScope(actor, org, "inventory.item_warehouses.update"),
  ]);
  const warehouses = await pool.query(
    `SELECT id::text,name,is_active FROM inventory_warehouses WHERE organization_id=$1 AND ($2::bigint[] IS NULL OR id=ANY($2::bigint[])) ORDER BY name`,
    [org, read],
  );
  const catalogEdit = await readPermissionScope(actor, org, "inventory.catalog.update");
  return {
    categories: categories.rows,
    units: units.rows,
    warehouses: warehouses.rows.map((w) => ({
      ...w,
      canManage: edit === null || edit.includes(w.id),
    })),
    canManageCatalog: catalogEdit === null || catalogEdit.length > 0,
  };
}
export async function saveCatalog(kind, id, input, actor, requestId, file = null) {
  assertCatalogKind(kind);
  await assertCatalogWrite(
    actor,
    input.organizationId,
    id ? "inventory.catalog.update" : "inventory.catalog.create",
  );
  let prepared = null;
  try {
    if (file) {
      if (kind !== "items")
        throw new ServiceError(
          "FILE_NOT_APPLICABLE",
          "Foto hanya dapat diunggah untuk barang.",
          400,
        );
      prepared = await prepareEmployeeFileUpload({
        file,
        fileKind: "inventory_photo",
        employeeId: null,
        organizationId: input.organizationId,
      });
    }
    return await withTransaction(async (client) => {
      await client.query("SELECT id FROM users WHERE id=$1 FOR SHARE", [actor.id]);
      await client.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [
        input.organizationId,
      ]);
      await client.query(
        "SELECT module_code FROM organization_modules WHERE organization_id=$1 AND module_code='inventory' FOR SHARE",
        [input.organizationId],
      );
      await assertCatalogWrite(
        actor,
        input.organizationId,
        id ? "inventory.catalog.update" : "inventory.catalog.create",
        client,
      );
      let before = null;
      if (id) {
        before = (
          await client.query(
            `SELECT id::text,code,name,notes,is_active,version${kind === "items" ? ",category_id::text,unit_id::text,photo_file_id::text" : kind === "units" ? ",allows_fractional" : ""} FROM ${TABLES[kind]} WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
            [input.organizationId, id],
          )
        ).rows[0];
        if (!before) throw new ServiceError("NOT_FOUND", "Data katalog tidak ditemukan.", 404);
        if (before.version !== input.version)
          throw new ServiceError(
            "VERSION_CONFLICT",
            "Data telah berubah. Muat ulang sebelum menyimpan.",
            409,
          );
      }
      if (kind === "items")
        for (const [field, table] of [
          ["categoryId", "inventory_categories"],
          ["unitId", "inventory_units"],
        ]) {
          const valid = await client.query(
            `SELECT id FROM ${table} WHERE organization_id=$1 AND id=$2 AND (is_active OR id=$3) FOR SHARE`,
            [
              input.organizationId,
              input[field],
              before?.[field === "categoryId" ? "category_id" : "unit_id"] || null,
            ],
          );
          if (!valid.rowCount)
            throw new ServiceError(
              "CATALOG_REFERENCE_INVALID",
              "Pilih kategori dan satuan aktif dalam organisasi ini.",
              400,
              { [field]: "Pilihan tidak tersedia." },
            );
        }
      if (kind === "units" && before && before.allows_fractional !== input.allowsFractional) {
        const used = await client.query(
          "SELECT 1 FROM inventory_items WHERE organization_id=$1 AND unit_id=$2 LIMIT 1",
          [input.organizationId, id],
        );
        if (used.rowCount)
          throw new ServiceError(
            "UNIT_USED",
            "Aturan pecahan tidak dapat diubah setelah satuan digunakan. Buat satuan baru.",
            409,
            { allowsFractional: "Satuan sudah digunakan oleh barang." },
          );
      }
      if (kind === "items" && before && String(before.unit_id) !== String(input.unitId)) {
        const used = await client.query(
          "SELECT 1 FROM inventory_item_warehouses WHERE organization_id=$1 AND item_id=$2 LIMIT 1",
          [input.organizationId, id],
        );
        if (used.rowCount)
          throw new ServiceError(
            "ITEM_UNIT_LOCKED",
            "Satuan tidak dapat diubah setelah barang digunakan di gudang.",
            409,
            { unitId: "Satuan sudah digunakan di gudang." },
          );
      }
      let photoId = before?.photo_file_id || null;
      if (prepared) {
        await finalizePreparedEmployeeFile(prepared);
        photoId = (
          await insertPreparedEmployeeFile(client, prepared, {
            employeeId: null,
            organizationId: input.organizationId,
            actor,
            requestId,
          })
        ).id;
      } else if (input.photoAction === "remove") photoId = null;
      const columns = ["code", "name", "notes", "is_active"];
      // Satuan tanpa kode memakai identitas internal stabil; edit mempertahankan kode lama.
      const code =
        input.code ?? before?.code ?? `UNIT_${randomUUID().replaceAll("-", "").toUpperCase()}`;
      const values = [code, input.name, input.notes, input.isActive];
      if (kind === "units") {
        columns.push("allows_fractional");
        values.push(input.allowsFractional);
      }
      if (kind === "items") {
        columns.push("category_id", "unit_id", "photo_file_id");
        values.push(input.categoryId, input.unitId, photoId);
      }
      let row;
      if (id)
        row = (
          await client.query(
            `UPDATE ${TABLES[kind]} SET ${columns.map((c, i) => `${c}=$${i + 3}`).join(",")},version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING id::text,version`,
            [input.organizationId, id, ...values],
          )
        ).rows[0];
      else
        row = (
          await client.query(
            `INSERT INTO ${TABLES[kind]}(organization_id,${columns.join(",")}) VALUES($1,${values.map((_, i) => `$${i + 2}`).join(",")}) RETURNING id::text,version`,
            [input.organizationId, ...values],
          )
        ).rows[0];
      if (before?.photo_file_id && before.photo_file_id !== photoId) {
        const old = (
          await client.query(
            "SELECT id,object_key FROM stored_files file WHERE file.organization_id=$1 AND file.id=$2 AND NOT EXISTS(SELECT 1 FROM inventory_items other WHERE other.organization_id=file.organization_id AND other.photo_file_id=file.id) FOR UPDATE",
            [input.organizationId, before.photo_file_id],
          )
        ).rows;
        await stageStoredFilesForDeletion(client, old, {
          organizationId: input.organizationId,
          actorId: actor.id,
          reasonCode: "inventory_photo_replaced",
        });
      }
      await writeAudit(client, {
        organizationId: input.organizationId,
        actorUserId: actor.id,
        action: `inventory.${kind}.${id ? "update" : "create"}`,
        entityType: TABLES[kind],
        entityId: row.id,
        beforeData: before,
        afterData: { ...input, code, photoFileId: photoId },
        requestId,
      });
      return row;
    });
  } catch (error) {
    if (prepared) await discardPreparedEmployeeFile(prepared);
    if (error.code === "23505")
      throw new ServiceError(
        "CATALOG_DUPLICATE",
        kind === "units"
          ? "Nama satuan sudah digunakan dalam organisasi ini."
          : "Kode atau nama sudah digunakan dalam organisasi ini.",
        409,
        kind === "units"
          ? { name: "Gunakan nama satuan yang berbeda." }
          : { code: "Gunakan kode berbeda.", name: "Periksa nama yang sudah terdaftar." },
      );
    throw error;
  }
}
export async function listItemWarehouses(org, itemId, actor) {
  await requireInventoryAccess(actor, org, "inventory.catalog.read");
  const scope = await readPermissionScope(actor, org, "inventory.warehouses.read");
  return (
    await pool.query(
      `SELECT link.warehouse_id::text,warehouse.name,link.minimum_stock::text,link.is_active,link.version FROM inventory_item_warehouses link JOIN inventory_warehouses warehouse ON warehouse.organization_id=link.organization_id AND warehouse.id=link.warehouse_id WHERE link.organization_id=$1 AND link.item_id=$2 AND ($3::bigint[] IS NULL OR link.warehouse_id=ANY($3::bigint[])) ORDER BY warehouse.name`,
      [org, itemId, scope],
    )
  ).rows;
}
export async function saveItemWarehouse(org, itemId, input, actor, requestId) {
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id=$1 FOR SHARE", [actor.id]);
    await client.query("SELECT id FROM organizations WHERE id=$1 FOR NO KEY UPDATE", [org]);
    await client.query(
      "SELECT module_code FROM organization_modules WHERE organization_id=$1 AND module_code='inventory' FOR SHARE",
      [org],
    );
    await requireInventoryAccess(
      actor,
      org,
      "inventory.item_warehouses.update",
      input.warehouseId,
      client,
    );
    const item = (
      await client.query(
        `SELECT item.id,unit.allows_fractional FROM inventory_items item JOIN inventory_units unit ON unit.organization_id=item.organization_id AND unit.id=item.unit_id WHERE item.organization_id=$1 AND item.id=$2 AND item.is_active FOR SHARE OF item,unit`,
        [org, itemId],
      )
    ).rows[0];
    if (!item)
      throw new ServiceError("ITEM_INVALID", "Pilih barang aktif dalam organisasi ini.", 400);
    if (!item.allows_fractional && !Number.isInteger(input.minimumStock))
      throw new ServiceError(
        "QUANTITY_FRACTION_INVALID",
        "Satuan barang ini hanya menerima jumlah bulat.",
        400,
        { minimumStock: "Gunakan angka bulat." },
      );
    const warehouse = await client.query(
      "SELECT id FROM inventory_warehouses WHERE organization_id=$1 AND id=$2 AND is_active FOR SHARE",
      [org, input.warehouseId],
    );
    if (!warehouse.rowCount)
      throw new ServiceError("WAREHOUSE_INVALID", "Gudang tidak aktif atau tidak tersedia.", 400, {
        warehouseId: "Pilih gudang aktif.",
      });
    const before = (
      await client.query(
        "SELECT version,minimum_stock::text,is_active FROM inventory_item_warehouses WHERE organization_id=$1 AND item_id=$2 AND warehouse_id=$3 FOR UPDATE",
        [org, itemId, input.warehouseId],
      )
    ).rows[0];
    if ((before?.version || 0) !== input.version)
      throw new ServiceError(
        "VERSION_CONFLICT",
        "Pengaturan gudang berubah. Muat ulang lalu coba kembali.",
        409,
      );
    const after = (
      await client.query(
        `INSERT INTO inventory_item_warehouses(organization_id,item_id,warehouse_id,minimum_stock,is_active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,item_id,warehouse_id) DO UPDATE SET minimum_stock=EXCLUDED.minimum_stock,is_active=EXCLUDED.is_active,version=inventory_item_warehouses.version+1,updated_at=now() RETURNING version`,
        [org, itemId, input.warehouseId, input.minimumStock, input.isActive],
      )
    ).rows[0];
    await writeAudit(client, {
      organizationId: org,
      actorUserId: actor.id,
      action: "inventory.item_warehouse.configure",
      entityType: "inventory_item",
      entityId: itemId,
      beforeData: before,
      afterData: input,
      requestId,
    });
    return after;
  });
}
