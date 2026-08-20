"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export default function useDataList(endpoint) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [state, setState] = useState({ data: [], loading: true, error: "" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useMemo(() => {
    const params = new URLSearchParams({
      search: debouncedSearch,
      status,
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    return params.toString();
  }, [debouncedSearch, filters, pagination.page, pagination.pageSize, status]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => setState((current) => ({ ...current, loading: true, error: "" })))
      .then(() => fetch(`${endpoint}?${query}`, { signal: controller.signal }))
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Data tidak dapat dimuat.");
        return body;
      })
      .then((body) => {
        setState({ data: body.data || [], loading: false, error: "" });
        setPagination((current) => ({ ...current, total: body.pagination?.total || 0 }));
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setState((current) => ({ ...current, loading: false, error: error.message }));
      });
    return () => controller.abort();
  }, [endpoint, query, refreshKey]);

  const setPage = useCallback(
    (page, pageSize) =>
      setPagination((current) => ({ ...current, page, pageSize, total: current.total })),
    [],
  );
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  const updateFilters = useCallback((values) => {
    setFilters(values);
    setPagination((current) => ({ ...current, page: 1 }));
  }, []);
  return {
    ...state,
    search,
    setSearch: (value) => {
      setSearch(value);
      setPagination((current) => ({ ...current, page: 1 }));
    },
    status,
    setStatus: (value) => {
      setStatus(value);
      setPagination((current) => ({ ...current, page: 1 }));
    },
    filters,
    updateFilters,
    pagination,
    setPage,
    refresh,
  };
}
