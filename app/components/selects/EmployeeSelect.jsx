"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useEffect, useRef, useState } from "react";
import AsyncSelect from "@/app/components/forms/AsyncSelect";

/** EmployeeSelect memuat pegawai aktif sesuai organisasi dan scope actor dari endpoint berizin. */
export default function EmployeeSelect({ organizationId, excludeId, onError, ...props }) {
  const [state, setState] = useState({ loading: false, options: [] });
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!organizationId) return undefined;
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ organizationId: String(organizationId) });
    if (excludeId) params.set("excludeId", String(excludeId));

    Promise.resolve()
      .then(() => active && setState((current) => ({ ...current, loading: true })))
      .then(() => fetch(`/api/employees/options?${params}`, { signal: controller.signal }))
      .then(async (response) => {
        const body = await readApiResponse(response);
        if (active)
          setState({
            loading: false,
            options: (body.data || []).map((employee) => ({
              value: employee.id,
              label: `${employee.employee_no} - ${employee.full_name}`,
              employee,
            })),
          });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        if (active) {
          setState({ loading: false, options: [] });
          onErrorRef.current?.(error.message || "Daftar pegawai tidak dapat dimuat.");
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [excludeId, organizationId]);

  return (
    <AsyncSelect
      {...props}
      loading={organizationId ? state.loading : false}
      options={organizationId ? state.options : []}
      disabled={!organizationId || props.disabled}
      placeholder={props.placeholder || "Pilih pegawai"}
      notFoundContent={state.loading ? "Memuat pegawai..." : "Pegawai tidak ditemukan"}
    />
  );
}
