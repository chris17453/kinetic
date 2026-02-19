import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api/client';
import type { Connection, PagedResponse } from '../lib/api/types';

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<PagedResponse<Connection>>('/connections');
      return res.data.items;
    },
  });
}

export function useConnection(id: string | undefined) {
  return useQuery({
    queryKey: ['connections', id],
    queryFn: async () => {
      const res = await api.get<Connection>(`/connections/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      type: string;
      connectionString: string;
      visibility: string;
    }) => {
      const res = await api.post<Connection>('/connections', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

export function useUpdateConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Connection> }) => {
      const res = await api.put<Connection>(`/connections/${id}`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', variables.id] });
    },
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (data: { type: string; connectionString: string }) => {
      const res = await api.post<{ success: boolean; message?: string; latencyMs?: number }>(
        '/connections/test',
        data
      );
      return res.data;
    },
  });
}

export function useConnectionSchema(connectionId: string | undefined) {
  return useQuery({
    queryKey: ['connections', connectionId, 'schema'],
    queryFn: async () => {
      const res = await api.get<{
        tables: Array<{
          schema: string;
          name: string;
          type: 'table' | 'view';
          columns: Array<{
            name: string;
            dataType: string;
            nullable: boolean;
            isPrimaryKey: boolean;
          }>;
        }>;
      }>(`/connections/${connectionId}/schema`);
      return res.data;
    },
    enabled: !!connectionId,
    staleTime: 5 * 60 * 1000, // Cache schema for 5 minutes
  });
}
