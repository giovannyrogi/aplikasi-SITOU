"use client";

import { useEffect, useState } from "react";
import AsyncSelect from "../forms/AsyncSelect";

export default function LocationSelect({ organizationId, ...props }) {
  const [state, setState] = useState({ loading: false, options: [] });
  useEffect(() => {
    if (!organizationId) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => active && setState((state) => ({ ...state, loading: true })))
      .then(() => fetch(`/api/locations/options?organizationId=${organizationId}`))
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
  }, [organizationId]);
  return (
    <AsyncSelect
      disabled={!organizationId}
      placeholder={organizationId ? "Pilih lokasi" : "Pilih organisasi lebih dahulu"}
      loading={organizationId ? state.loading : false}
      options={organizationId ? state.options : []}
      {...props}
    />
  );
}
