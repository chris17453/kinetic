import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Report } from '../../lib/api/types';

interface Props { show: boolean; onClose: () => void; }

export function SearchModal({ show, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data: results } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await api.get<{ items: Report[] }>('/reports', { params: { search: query, pageSize: '8' } });
      return res.data.items;
    },
    enabled: query.length > 1,
  });

  useEffect(() => {
    if (show) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  const go = (path: string) => { navigate(path); onClose(); };

  const quickLinks = [
    { icon: 'fa-plus', label: 'New Report', path: '/reports/new' },
    { icon: 'fa-terminal', label: 'Playground', path: '/playground' },
    { icon: 'fa-server', label: 'Connections', path: '/connections' },
    { icon: 'fa-upload', label: 'Upload Data', path: '/upload' },
  ];

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg mt-5" onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-body p-0">
            <div className="input-group border-0">
              <span className="input-group-text bg-white border-0 ps-3">
                <i className="fa-solid fa-magnifying-glass text-muted"></i>
              </span>
              <input
                ref={inputRef}
                className="form-control search-modal-input border-0"
                placeholder="Search reports, connections… (Esc to close)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && onClose()}
              />
              <span className="input-group-text bg-white border-0 pe-3 text-muted small">Esc</span>
            </div>
            <div className="border-top">
              {!query && (
                <div className="p-3">
                  <div className="text-muted small fw-semibold mb-2 px-1">QUICK ACTIONS</div>
                  {quickLinks.map(l => (
                    <button key={l.path} className="d-flex align-items-center gap-2 w-100 btn btn-link text-start text-decoration-none text-dark p-2 rounded" onClick={() => go(l.path)}>
                      <i className={`fa-solid ${l.icon} text-primary`} style={{ width: 20 }}></i>
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
              {results && results.length > 0 && (
                <div className="p-3">
                  <div className="text-muted small fw-semibold mb-2 px-1">REPORTS</div>
                  {results.map(r => (
                    <button key={r.id} className="d-flex align-items-center gap-2 w-100 btn btn-link text-start text-decoration-none text-dark p-2 rounded" onClick={() => go(`/reports/${r.id}`)}>
                      <i className="fa-solid fa-chart-bar text-primary" style={{ width: 20 }}></i>
                      <div>
                        <div className="fw-medium">{r.name}</div>
                        <div className="small text-muted">{r.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {query.length > 1 && results?.length === 0 && (
                <div className="p-4 text-center text-muted small">No results for "{query}"</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
