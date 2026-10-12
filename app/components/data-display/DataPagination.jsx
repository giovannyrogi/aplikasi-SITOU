"use client";

import { Button, Select } from "antd";
import { Box } from "@mui/material";
import FontStyle from "../font-style/FontStyle";
import { paginationTotalLabel } from "./rowNumbers.mjs";

/** Footer pagination bersama untuk daftar bernomor maupun keyset/cursor. */
export default function DataPagination({ pagination, onPageChange, cursor, onPrevious, onNext, onPageSizeChange, loading = false, total, pageSize, pageSizeOptions = [10, 20, 50], ariaLabel = "Navigasi halaman data", summary, sx }) {
  if (!cursor && !pagination) return null;
  const currentPage = cursor ? cursor.page : pagination.page;
  const currentSize = Number(pageSize ?? pagination?.pageSize ?? 10);
  const currentTotal = total ?? pagination?.total ?? null;
  const canGoForward = cursor ? Boolean(cursor.next) : currentTotal != null && currentPage * currentSize < Number(currentTotal);
  const changeSize = (value) => onPageSizeChange ? onPageSizeChange(value) : onPageChange?.(1, value);

  return <Box component="nav" aria-label={ariaLabel} sx={{display:"flex",alignItems:"center",justifyContent:"flex-end",flexWrap:"wrap",gap:1,minWidth:0,pt:2,...sx}}>
    <FontStyle role="status" aria-live="polite" fontSize={12.5} sx={{color:"text.secondary",mr:{sm:"auto"},flexBasis:{xs:"100%",sm:"auto"}}}>{summary || paginationTotalLabel(currentTotal)}</FontStyle>
    <Button onClick={cursor ? onPrevious : () => onPageChange?.(currentPage-1,currentSize)} disabled={loading || currentPage<=1} style={{minHeight:44}}>Sebelumnya</Button>
    <Button onClick={cursor ? onNext : () => onPageChange?.(currentPage+1,currentSize)} disabled={loading || !canGoForward} style={{minHeight:44}}>Berikutnya</Button>
    {pageSizeOptions.length ? <Select aria-label="Jumlah baris per halaman" value={currentSize} onChange={changeSize} disabled={loading} options={pageSizeOptions.map((value)=>({value,label:`${value} / halaman`}))} style={{minWidth:132,minHeight:44}}/> : null}
  </Box>;
}
