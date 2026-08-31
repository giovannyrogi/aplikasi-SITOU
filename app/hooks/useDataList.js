"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

export default function useDataList(endpoint, { requiredFilter } = {}) {
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const activeController = useRef(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [state, setState] = useState({ data: [], loading: true, error: "" });
  const enabled = !requiredFilter || Boolean(filters[requiredFilter]);

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

  const load = useCallback(async () => {
    activeController.current?.abort();

    if (!enabled) {
      setState({ data: [], loading: false, error: "" });
      setPagination((current) => ({ ...current, page: 1, total: 0 }));
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setState((current) => ({ ...current, loading: true, error: "" }));
      }
    });

    try {
      await runWithLoadingBackdrop(
        async () => {
          const response = await fetch(endpoint + "?" + query, { signal: controller.signal });
          const body = await readApiResponse(response, "Data tidak dapat dimuat.");
          if (controller.signal.aborted || activeController.current !== controller) return;

          setState({ data: body.data || [], loading: false, error: "" });
          setPagination((current) => ({ ...current, total: body.pagination?.total || 0 }));
        },
        { message: "Memuat data..." },
      );
    } catch (error) {
      if (
        error.name !== "AbortError" &&
        !controller.signal.aborted &&
        activeController.current === controller
      ) {
        setState((current) => ({ ...current, loading: false, error: error.message }));
      }
    }
  }, [enabled, endpoint, query, runWithLoadingBackdrop]);

  useEffect(() => {
    const request = load();
    return () => {
      activeController.current?.abort();
      void request;
    };
  }, [load]);

  const setPage = useCallback(
    (page, pageSize) =>
      setPagination((current) => ({ ...current, page, pageSize, total: current.total })),
    [],
  );
  const refresh = useCallback(() => load(), [load]);
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
