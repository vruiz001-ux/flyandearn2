'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { DataTable, Column, exportToCSV } from '@/components/tables/DataTable';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

interface Request {
  id: string;
  title: string;
  category: string;
  status: string;
  itemPrice: number;
  commission: number;
  currency: string;
  route: string;
  createdAt: string;
  requester: { id: string; displayName: string | null; email: string };
  matchCount: number;
}

const CATEGORIES = ['ELECTRONICS', 'FASHION', 'COSMETICS', 'FOOD', 'DOCUMENTS', 'MEDICINE', 'LUXURY', 'OTHER'];
const STATUSES = ['DRAFT', 'OPEN', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'];

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, perPage: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', category: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        perPage: pagination.perPage.toString(),
        sortBy,
        sortDirection,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
      });

      const response = await fetch(`/api/admin/requests?${params}`);
      const data = await response.json();

      if (data.success) {
        setRequests(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.perPage, filters, sortBy, sortDirection]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const columns: Column<Request>[] = [
    {
      key: 'title',
      header: 'Request',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          <p className="text-xs text-gray-400">{row.requester.displayName || row.requester.email}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (value) => <Badge>{String(value)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={String(value)} />,
    },
    {
      key: 'route',
      header: 'Route',
      render: (value) => <span className="text-sm">{String(value)}</span>,
    },
    {
      key: 'itemPrice',
      header: 'Price',
      sortable: true,
      render: (value, row) => formatCurrency(Number(value), row.currency),
    },
    {
      key: 'commission',
      header: 'Commission',
      render: (value, row) => formatCurrency(Number(value), row.currency),
    },
    {
      key: 'matchCount',
      header: 'Matches',
      render: (value) => String(value ?? 0),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (value) => formatRelativeTime(String(value)),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Requests</h1>
          <p className="text-gray-400 mt-1">Manage marketplace requests</p>
        </div>
        <button onClick={() => exportToCSV(requests, columns, 'requests-export')} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <input type="text" placeholder="Search requests..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="input-field max-w-xs" />
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="input-field max-w-[150px]">
              <option value="">All Status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.category} onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))} className="input-field max-w-[150px]">
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={requests}
          loading={loading}
          pagination={pagination}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onSort={(key, dir) => { setSortBy(key); setSortDirection(dir); }}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onRowClick={(row) => router.push(`/admin/requests/${row.id}`)}
          emptyMessage="No requests found"
        />
      </Card>
    </div>
  );
}
