import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api/client';
import type { QueryResult } from '../lib/types';

interface UseQueryExecutionOptions {
  onSuccess?: (result: QueryResult) => void;
  onError?: (error: Error) => void;
}

interface ExecuteQueryParams {
  connectionId: string;
  query: string;
  parameters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
  timeout?: number;
}

export function useQueryExecution(options: UseQueryExecutionOptions = {}) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeMutation = useMutation({
    mutationFn: async (params: ExecuteQueryParams) => {
      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsExecuting(true);

      try {
        const res = await api.post<QueryResult>(
          '/query/execute',
          {
            connectionId: params.connectionId,
            sql: params.query,
            parameters: params.parameters,
            page: params.page ?? 1,
            pageSize: params.pageSize ?? 100,
            timeoutSeconds: params.timeout ?? 30,
          },
          {
            signal: abortControllerRef.current.signal,
          }
        );
        return res.data;
      } finally {
        setIsExecuting(false);
      }
    },
    onSuccess: (data) => {
      setResult(data);
      options.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options.onError?.(error);
    },
  });

  const execute = useCallback(
    (params: ExecuteQueryParams) => {
      return executeMutation.mutateAsync(params);
    },
    [executeMutation]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsExecuting(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
  }, []);

  return {
    execute,
    cancel,
    clear,
    result,
    isExecuting,
    error: executeMutation.error,
  };
}

export function useQueryValidation() {
  return useMutation({
    mutationFn: async ({ connectionId, query }: { connectionId: string; query: string }) => {
      const res = await api.post<{
        valid: boolean;
        errors: Array<{ line: number; column: number; message: string }>;
        warnings: Array<{ line: number; message: string }>;
      }>('/query/validate', {
        connectionId,
        sql: query,
      });
      return res.data;
    },
  });
}

export function useQueryExplain() {
  return useMutation({
    mutationFn: async ({ connectionId, query }: { connectionId: string; query: string }) => {
      const res = await api.post<{
        plan: string;
        estimatedCost: number;
        estimatedRows: number;
      }>('/query/explain', {
        connectionId,
        sql: query,
      });
      return res.data;
    },
  });
}
