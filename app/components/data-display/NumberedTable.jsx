"use client";

import { useState } from "react";
import { Table } from "antd";
import { numberedColumns, rowNumberOffset } from "./rowNumbers.mjs";

/** AntD Table bersama dengan nomor berlanjut, termasuk pagination client yang uncontrolled. */
export default function NumberedTable({ columns = [], pagination, rowOffset, onChange, ...props }) {
  const [position, setPosition] = useState({
    current: pagination?.defaultCurrent || 1,
    pageSize: pagination?.defaultPageSize || 10,
  });
  const effective =
    pagination === false
      ? false
      : {
          ...position,
          ...pagination,
          current: pagination?.current ?? position.current,
          pageSize: pagination?.pageSize ?? position.pageSize,
        };
  const offset = rowNumberOffset(effective, rowOffset);
  return (
    <Table
      {...props}
      columns={numberedColumns(columns, offset)}
      pagination={effective}
      onChange={(next, filters, sorter, extra) => {
        setPosition({ current: next.current || 1, pageSize: next.pageSize || 10 });
        pagination?.onChange?.(next.current || 1, next.pageSize || 10);
        onChange?.(next, filters, sorter, extra);
      }}
    />
  );
}
