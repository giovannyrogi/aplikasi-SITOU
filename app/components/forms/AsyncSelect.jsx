"use client";

import { Select } from "antd";
export default function AsyncSelect({ options = [], loading, ...props }) {
  return (
    <Select {...props} showSearch optionFilterProp="label" loading={loading} options={options} />
  );
}
