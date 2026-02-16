'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable, Column, exportToCSV } from '@/components/tables/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { formatCurrency, formatRelativeTime, formatDateTime } from '@/lib/utils';

interface Match {
  id: string;
  status: string;
  agreedPrice: number | null;
  commission: number | null;
  platformFee: number | null;
  currency: string;
  expectedDelivery: string | null;
  createdAt: string;
  completedAt: string | null;
  request: { id: string; title: string; status: string };
  traveller: { id: string; displayName: string | null; email: string };
}

const STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'PURCHASED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'DISPUTED'];

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, perPage: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ status: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [kpis, setKpis] = useState({ acceptanceRate: 0, completionRate: 0, totalAccepted: 0, totalCompleted: 0 });

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        perPage: pagination.perPage.toString(),
        sortBy,
        sortDirection,
        ...(filters.status && { status: filters.status }),
      });

      const response = await fetch(`/api/admin/matches?${params}`);
      const data = await response.json();

      if (data.success) {
        setMatches(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
        setKpis(data.kpis);
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.perPage, filters, sortBy, sortDirection]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const columns: Column<Match>[] = [
    {
      key: 'request',
      header: 'Request',
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.request.title}</p>
          <StatusBadge status={row.request.status} />
        </div>
      ),
    },
    {
      key: 'traveller',
      header: 'Traveller',
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.traveller.displayName || 'Unknown'}</p>
          <p className="text-xs text-gray-400">{row.traveller.email}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={String(value)} />,
    },
    {
      key: 'agreedPrice',
      header: 'Price',
      render: (value, row) => value ? formatCurrency(Number(value), row.currency) : '-',
    },
    {
      key: 'commission',
      header: 'Commission',
      render: (value, row) => value ? formatCurrency(Number(value), row.currency) : '-',
    },
    {
      key: 'platformFee',
      header: 'Platform Fee',
      render: (value, row) => value ? formatCurrency(Number(value), row.currency) : '-',
    },
    {
      key: 'expectedDelivery',
      header: 'Expected Delivery',
      render: (value) => value ? formatDateTime(String(value)) : '-',
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
          <h1 className="text-2xl font-bold">Matches</h1>
          <p className="text-gray-400 mt-1">Traveller acceptances and deal tracking</p>
        </div>
        <button onClick={() => exportToCSV(matches, columns, 'matches-export')} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Acceptance Rate" value={`${kpis.acceptanceRate.toFixed(1)}%`} />
        <KPICard title="Completion Rate" value={`${kpis.completionRate.toFixed(1)}%`} />
        <KPICard title="Total Accepted" value={kpis.totalAccepted} />
        <KPICard title="Total Completed" value={kpis.totalCompleted} />
      </div>

      <Card>
        <CardContent className="py-4">
          <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} className="input-field max-w-[200px]">
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={matches}
          loading={loading}
          pagination={pagination}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onSort={(key, dir) => { setSortBy(key); setSortDirection(dir); }}
          sortBy={sortBy}
          sortDirection={sortDirection}
          emptyMessage="No matches found"
        />
      </Card>
    </div>
  );
}
