"use client";

import { useEffect, useState } from "react";
import AsyncSelect from "../forms/AsyncSelect";

/** Memuat jenis unit aktif berdasarkan organisasi dan mempertahankan pilihan edit lama. */
export default function OrganizationUnitTypeSelect({ organizationId, includeId, ...props }) {
  const [state, setState] = useState({ loading: false, options: [] });

  useEffect(() => {
    if (!organizationId) return undefined;
    let active = true;
    const query = new URLSearchParams({ organizationId: String(organizationId) });
    if (includeId) query.set("includeId", String(includeId));
    Promise.resolve()
      .then(() => active && setState((current) => ({ ...current, loading: true })))
      .then(() => fetch(`/api/organization-unit-types/options?${query}`))
      .then((response) => response.json())
      .then((body) => {
        if (!active) return;
        setState({
          loading: false,
          options: (body.data || []).map((item) => ({
            value: item.id,
            label: `${item.name}${item.is_active ? "" : " (nonaktif)"}`,
          })),
        });
      })
      .catch(() => active && setState({ loading: false, options: [] }));
    return () => {
      active = false;
    };
  }, [includeId, organizationId]);

  return (
    <AsyncSelect
      disabled={!organizationId}
      placeholder={organizationId ? "Pilih jenis unit" : "Pilih organisasi lebih dahulu"}
      notFoundContent="Belum ada jenis unit. Buat melalui menu Jenis Unit Organisasi."
      loading={organizationId ? state.loading : false}
      options={organizationId ? state.options : []}
      {...props}
    />
  );
}
