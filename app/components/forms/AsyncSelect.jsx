"use client";

import { Select } from "antd";
export default function AsyncSelect({ options = [], loading, showSearch = true, ...props }) {
  return (
    <Select
      {...props}
      showSearch={showSearch}
      optionFilterProp="label"
      loading={loading}
      options={options}
    />
  );
}
