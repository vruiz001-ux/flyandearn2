'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable, Column, exportToCSV } from '@/components/tables/DataTable';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  payoutMethod: string | null;
  createdAt: string;
  completedAt: string | null;
  user: { id: string; displayName: string | null; email: string };
}

const TYPES = ['TOPUP', 'HOLD', 'RELEASE', 'PAYOUT', 'REFUND', 'FEE', 'ADJUSTMENT'];
const STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'];

export default function WalletPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, perPage: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [stats, setStats] = useState({ totalBalance: 0, totalHeld: 0, pendingPayouts: 0, pendingPayoutsCount: 0, completedPayouts: 0 });

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        perPage: pagination.perPage.toString(),
        sortBy,
        sortDirection,
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status }),
      });

      const response = await fetch(`/api/admin/wallet?${params}`);
      const data = await response.json();

      if (data.success) {
        setTransactions(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.perPage, filters, sortBy, sortDirection]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const columns: Column<Transaction>[] = [
    {
      key: 'user',
      header: 'User',
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.user.displayName || 'Unknown'}</p>
          <p className="text-xs text-gray-400">{row.user.email}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (value) => {
        const variant = value === 'PAYOUT' || value === 'REFUND' ? 'danger' : value === 'TOPUP' || value === 'RELEASE' ? 'success' : 'default';
        return <Badge variant={variant}>{String(value)}</Badge>;
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (value, row) => (
        <span className={Number(value) >= 0 ? 'text-green-400' : 'text-red-400'}>
          {Number(value) >= 0 ? '+' : ''}{formatCurrency(Number(value), row.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (value) => <StatusBadge status={String(value)} />,
    },
    {
      key: 'description',
      header: 'Description',
      render: (value) => <span className="text-sm text-gray-400">{String(value) || '-'}</span>,
    },
    {
      key: 'payoutMethod',
      header: 'Method',
      render: (value) => (value as string) || '-',
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
          <h1 className="text-2xl font-bold">Wallet & Transactions</h1>
          <p className="text-gray-400 mt-1">Manage wallet balances and payouts</p>
        </div>
        <button onClick={() => exportToCSV(transactions, columns, 'transactions-export')} className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Balance" value={formatCurrency(stats.totalBalance)} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>} />
        <KPICard title="Total Held" value={formatCurrency(stats.totalHeld)} changeLabel="in escrow" />
        <KPICard title="Pending Payouts" value={formatCurrency(stats.pendingPayouts)} changeLabel={`${stats.pendingPayoutsCount} pending`} />
        <KPICard title="Completed Payouts" value={formatCurrency(stats.completedPayouts)} />
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))} className="input-field max-w-[150px]">
              <option value="">All Types</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="input-field max-w-[150px]">
              <option value="">All Status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={transactions}
          loading={loading}
          pagination={pagination}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onSort={(key, dir) => { setSortBy(key); setSortDirection(dir); }}
          sortBy={sortBy}
          sortDirection={sortDirection}
          emptyMessage="No transactions found"
        />
      </Card>
    </div>
  );
}
