import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api/client';
import type { Report, PagedResponse } from '../lib/api/types';

interface UseReportsOptions {
  page?: number;
  pageSize?: number;
  categoryId?: string;
  search?: string;
  tags?: string[];
  visibility?: string;
}

export function useReports(options: UseReportsOptions = {}) {
  const { page = 1, pageSize = 20, categoryId, search, tags, visibility } = options;

  return useQuery({
    queryKey: ['reports', { page, pageSize, categoryId, search, tags, visibility }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (categoryId) params.set('categoryId', categoryId);
      if (search) params.set('search', search);
      if (tags?.length) params.set('tags', tags.join(','));
      if (visibility) params.set('visibility', visibility);

      const res = await api.get<PagedResponse<Report>>(`/reports?${params}`);
      return res.data;
    },
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ['reports', id],
    queryFn: async () => {
      const res = await api.get<Report>(`/reports/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Report>) => {
      const res = await api.post<Report>('/reports', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Report> }) => {
      const res = await api.put<Report>(`/reports/${id}`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['reports', variables.id] });
    },
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useExecuteReport() {
  return useMutation({
    mutationFn: async ({
      reportId,
      parameters,
      page = 1,
      pageSize = 100,
    }: {
      reportId: string;
      parameters?: Record<string, unknown>;
      page?: number;
      pageSize?: number;
    }) => {
      const res = await api.post(`/reports/${reportId}/execute`, {
        parameters,
        page,
        pageSize,
      });
      return res.data;
    },
  });
}
