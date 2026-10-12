"use client";

import { readApiResponse } from "@/lib/api/clientError";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLoadingBackdrop } from "@/app/components/loading/LoadingBackdropProvider";

export default function useDataList(
  endpoint,
  { requiredFilter, initialFilters = {}, infinite = false } = {},
) {
  const { runWithLoadingBackdrop } = useLoadingBackdrop();
  const activeController = useRef(null);
  const loadMorePending = useRef(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [filters, setFilters] = useState(() => initialFilters);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [state, setState] = useState({
    data: [],
    loading: true,
    loadingMore: false,
    error: "",
    loadMoreError: "",
  });
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
    if (pagination.page === 1) loadMorePending.current = false;

    if (!enabled) {
      setState({ data: [], loading: false, loadingMore: false, error: "", loadMoreError: "" });
      setPagination((current) => ({ ...current, page: 1, total: 0 }));
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setState((current) => ({
          ...current,
          loading: !(infinite && pagination.page > 1),
          loadingMore: infinite && pagination.page > 1,
          error: "",
          loadMoreError: "",
        }));
      }
    });

    try {
      const request = async () => {
        const response = await fetch(endpoint + "?" + query, { signal: controller.signal });
        const body = await readApiResponse(response, "Data tidak dapat dimuat.");
        if (controller.signal.aborted || activeController.current !== controller) return;

        setState((current) => {
          const seen = new Set(current.data.map((item) => item.id));
          const incoming = (body.data || []).filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          return {
            data:
              infinite && pagination.page > 1 ? [...current.data, ...incoming] : body.data || [],
            loading: false,
            loadingMore: false,
            error: "",
            loadMoreError: "",
          };
        });
        setPagination((current) => ({ ...current, total: body.pagination?.total || 0 }));
      };
      if (infinite && pagination.page > 1) await request();
      else await runWithLoadingBackdrop(request, { message: "Memuat data..." });
    } catch (error) {
      if (
        error.name !== "AbortError" &&
        !controller.signal.aborted &&
        activeController.current === controller
      ) {
        setState((current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          error: infinite && pagination.page > 1 ? "" : error.message,
          loadMoreError: infinite && pagination.page > 1 ? error.message : "",
        }));
      }
    } finally {
      if (infinite && pagination.page > 1 && activeController.current === controller)
        loadMorePending.current = false;
    }
  }, [enabled, endpoint, infinite, pagination.page, query, runWithLoadingBackdrop]);

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
  const resetInfiniteList = useCallback(() => {
    if (!infinite) return;
    activeController.current?.abort();
    loadMorePending.current = false;
    setState({ data: [], loading: true, loadingMore: false, error: "", loadMoreError: "" });
  }, [infinite]);
  const refresh = useCallback(() => {
    if (infinite && pagination.page > 1) {
      resetInfiniteList();
      setPagination((current) => ({ ...current, page: 1 }));
      return;
    }
    return load();
  }, [infinite, load, pagination.page, resetInfiniteList]);
  const loadMore = useCallback(() => {
    if (
      !infinite ||
      loadMorePending.current ||
      state.loading ||
      state.loadingMore ||
      state.loadMoreError ||
      state.data.length >= pagination.total
    )
      return;
    loadMorePending.current = true;
    setPagination((current) => ({ ...current, page: current.page + 1 }));
  }, [
    infinite,
    pagination.total,
    state.data.length,
    state.loading,
    state.loadingMore,
    state.loadMoreError,
  ]);
  const updateFilters = useCallback(
    (values) => {
      resetInfiniteList();
      setFilters(values);
      setPagination((current) => ({ ...current, page: 1 }));
    },
    [resetInfiniteList],
  );

  return {
    ...state,
    search,
    setSearch: (value) => {
      resetInfiniteList();
      setSearch(value);
      setPagination((current) => ({ ...current, page: 1 }));
    },
    status,
    setStatus: (value) => {
      resetInfiniteList();
      setStatus(value);
      setPagination((current) => ({ ...current, page: 1 }));
    },
    filters,
    updateFilters,
    query,
    pagination,
    setPage,
    refresh,
    loadMore,
    retryLoadMore: load,
  };
}
