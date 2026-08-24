"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AsyncSelect from "../forms/AsyncSelect";

const EMPTY_EXCLUDE_IDS = [];

export default function OrganizationSelect({
  excludeIds = EMPTY_EXCLUDE_IDS,
  autoSelectFirst = false,
  value,
  onChange,
  ...props
}) {
  const [state, setState] = useState({ loading: true, options: [] });
  const didAutoSelect = useRef(false);
  const excludedIds = useMemo(() => new Set(excludeIds.map(String)), [excludeIds]);
  const visibleOptions = useMemo(
    () => state.options.filter((option) => !excludedIds.has(String(option.value))),
    [excludedIds, state.options],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/organizations/options")
      .then((response) => response.json())
      .then((body) => {
        if (!active) return;
        setState({
          loading: false,
          options: (body.data || []).map((item) => ({
            value: item.id,
            label: `${item.code} - ${item.name}`,
            disabled: !item.is_active || !item.has_access,
          })),
        });
      })
      .catch(() => active && setState({ loading: false, options: [] }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!autoSelectFirst || didAutoSelect.current || value || state.loading) return;
    didAutoSelect.current = true;
    const firstAvailable = visibleOptions.find((option) => !option.disabled);
    if (firstAvailable) onChange?.(firstAvailable.value, firstAvailable);
  }, [autoSelectFirst, onChange, state.loading, value, visibleOptions]);

  return (
    <AsyncSelect
      placeholder="Pilih organisasi"
      loading={state.loading}
      options={visibleOptions}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
}