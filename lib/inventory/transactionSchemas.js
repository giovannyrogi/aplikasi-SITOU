import { z } from "zod";

const id = z.coerce.number().int().positive("Pilihan tidak valid.");
const uuid = z.string().uuid();
const quantity = z.number().finite().min(0, "Jumlah tidak boleh negatif.").max(999999999999).multipleOf(0.001, "Maksimal tiga angka desimal.");
const optionalId = id.nullable().optional();
const optionalText = (max) => z.string().trim().max(max).nullable().optional();

export const transactionSchema = z.object({
  organizationId: id,
  transactionId: uuid,
  warehouseId: id,
  kind: z.enum(["opening", "receipt", "issue", "return", "stocktake"]),
  occurredOn: z.iso.date(),
  referenceNo: optionalText(100),
  notes: optionalText(2000),
  lateReason: optionalText(500),
  destinationLocationId: optionalId,
  destinationUnitId: optionalId,
  recipientEmployeeId: optionalId,
  sourceTransactionId: uuid.nullable().optional(),
  version: z.number().int().positive().optional(),
  lines: z.array(z.object({ itemId: id, quantity }).strict()).min(1, "Tambahkan sedikitnya satu barang.").max(100, "Maksimal 100 barang dalam satu transaksi."),
}).strict();

export const draftSchema = transactionSchema.extend({
  warehouseId: id.nullable().optional(),
  kind: z.enum(["opening", "receipt", "issue", "return", "stocktake"]).or(z.literal("")),
  occurredOn: z.iso.date().or(z.literal("")),
  lines: z.array(z.object({itemId: id.nullable(),quantity: quantity.nullable()}).strict()).max(100),
  currentStep: z.number().int().min(0).max(3).optional(),
}).strict();

export const cancellationSchema = z.object({
  organizationId: id,
  reason: z.string().trim().min(10, "Jelaskan alasan pembatalan minimal 10 karakter.").max(500),
  reversalId: uuid,
}).strict();
