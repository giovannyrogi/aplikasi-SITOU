const date = (value) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
export const formatStockQuantity=(value)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:3}).format(Number(value));
export const STOCK_MESSAGES = {
  OPENING_EXISTS: (f) => `Saldo awal ${f.item} di ${f.warehouse} sudah tersimpan. Gunakan Koreksi saldo awal untuk memperbaikinya.`,
  HISTORY_STARTED: (f) => `Pencatatan stok ${f.item} di ${f.warehouse} sudah dimulai. Saldo awal baru tidak dapat ditambahkan.`,
  HISTORY_REQUIRED: (f) => `Belum ada transaksi stok ${f.item} di ${f.warehouse}. Masukkan Barang Masuk atau Saldo Awal sebelum melanjutkan.`,
  BEFORE_OPENING: (f) => `Tanggal transaksi ${date(f.date)} lebih awal daripada saldo awal ${f.item} di ${f.warehouse}, yaitu ${date(f.openingDate)}. Tinjau saldo awal sebelum melanjutkan.`,
  HISTORICAL_STOCK_NEGATIVE: (f) => `Perubahan ini membuat stok ${f.item} di ${f.warehouse} menjadi ${formatStockQuantity(f.quantity)} ${f.unit} pada ${date(f.date)}. Periksa jumlah dan riwayat pada tanggal tersebut.`,
  SAME_DAY_STOCKTAKE: (f) => `Ada stok opname ${f.item} di ${f.warehouse} pada ${date(f.date)}. Transaksi terlambat pada tanggal yang sama belum dapat diproses karena urutan jam kejadian belum tersedia.`,
  VERSION_CONFLICT: () => "Riwayat stok telah berubah sejak perkiraan terakhir. Periksa kembali transaksi untuk mendapatkan perhitungan terbaru.",
  STOCK_LIMIT_EXCEEDED: (f) => `Jumlah stok ${f.item} di ${f.warehouse} pada ${date(f.date)} melewati kapasitas pencatatan. Kurangi jumlah atau minta administrator meninjau datanya.`,
  REVERSAL_SOURCE_INVALID: (f) => `Riwayat pembatalan pada ${date(f.date)} tidak memiliki transaksi asal yang dapat dihitung. Minta administrator meninjau riwayat stok ini.`,
  TRANSACTION_DATE_FUTURE: () => "Tanggal transaksi tidak boleh melewati hari ini.",
  TRANSACTION_DATE_TOO_OLD: () => "Tanggal transaksi melewati batas 30 hari terakhir.",
  INSUFFICIENT_STOCK: (f) => `Stok ${f.item} di ${f.warehouse} pada ${date(f.date)} hanya ${formatStockQuantity(f.quantity)} ${f.unit}. Kurangi jumlah barang yang dikeluarkan.`,
};
export const STOCK_MESSAGE_DEFINITIONS = Object.fromEntries(Object.keys(STOCK_MESSAGES).map((code)=>[code,{
  severity:code==="VERSION_CONFLICT"?"warning":"error",
  field:code.startsWith("TRANSACTION_DATE")?"occurredOn":"lines",
  action:code==="BEFORE_OPENING"?"reviewOpening":code==="VERSION_CONFLICT"?"repeatPreview":"reviewField",
  parameters:code==="BEFORE_OPENING"?["item","warehouse","date","openingDate"]:code==="HISTORICAL_STOCK_NEGATIVE"?["item","warehouse","date","quantity","unit"]:[],
}]));
export function stockMessage(code, facts) { return STOCK_MESSAGES[code]?.(facts) || "Perhitungan stok tidak dapat diproses. Hubungi administrator."; }
