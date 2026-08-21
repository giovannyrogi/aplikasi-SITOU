"use client";

import { useEffect, useState } from "react";
import AsyncSelect from "../forms/AsyncSelect";

export default function OrganizationSelect({ excludeIds = [], ...props }) {
  const [state, setState] = useState({ loading: true, options: [] });
  const excludedIds = new Set(excludeIds.map(String));
  useEffect(() => {
    let active = true;
    fetch("/api/organizations/options")
      .then((r) => r.json())
      .then((body) => {
        if (active)
          setState({
            loading: false,
            options: (body.data || []).map((item) => ({
              value: item.id,
              label: `${item.code} - ${item.name}`,
            })),
          });
      })
      .catch(() => active && setState({ loading: false, options: [] }));
    return () => {
      active = false;
    };
  }, []);
  return (
    <AsyncSelect
      placeholder="Pilih organisasi"
      loading={state.loading}
      options={state.options.filter((option) => !excludedIds.has(String(option.value)))}
      {...props}
    />
  );
}
