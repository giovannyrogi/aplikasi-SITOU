ALTER TABLE stored_files DROP CONSTRAINT ck_stored_files_category;
ALTER TABLE stored_files ADD CONSTRAINT ck_stored_files_category CHECK(category IN (
 'logo','employee_photo','attendance_photo','medical_letter','leave_attachment','contract',
 'assignment_decree','discipline_letter','identity','education','employee_import_source','other',
 'inventory_item_photo','inventory_transaction_attachment'
));

CREATE FUNCTION prevent_inventory_posted_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='posted' THEN
    RAISE EXCEPTION 'Transaksi stok terposting tidak boleh diubah atau dihapus.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_posted_immutable BEFORE UPDATE OR DELETE ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_posted_change();

CREATE FUNCTION prevent_inventory_ledger_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Riwayat stok tidak boleh diubah atau dihapus.';
END $$;
CREATE TRIGGER inventory_lines_immutable BEFORE UPDATE OR DELETE ON inventory_transaction_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_ledger_change();
CREATE TRIGGER inventory_movements_immutable BEFORE UPDATE OR DELETE ON inventory_stock_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_ledger_change();
CREATE TRIGGER inventory_openings_immutable BEFORE UPDATE OR DELETE ON inventory_stock_openings
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_ledger_change();
