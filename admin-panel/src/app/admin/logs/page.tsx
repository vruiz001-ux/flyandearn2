'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { DataTable, Column } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';

interface AuditLog {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  admin: { id: string; username: string } | null;
}

const ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT',
  'USER_VIEWED', 'USER_SUSPENDED', 'USER_UNSUSPENDED', 'USER_DELETED',
  'WALLET_ADJUSTED', 'WALLET_RESET',
  'REQUEST_STATUS_CHANGED', 'MATCH_STATUS_CHANGED',
  'PAYOUT_APPROVED', 'PAYOUT_REJECTED',
  'DISPUTE_RESOLVED', 'SETTINGS_CHANGED', 'EXPORT_DATA',
];

const actionVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold'> = {
  LOGIN_SUCCESS: 'success',
  LOGIN_FAILURE: 'danger',
  LOGOUT: 'default',
  USER_SUSPENDED: 'danger',
  USER_UNSUSPENDED: 'success',
  WALLET_RESET: 'warning',
  PAYOUT_APPROVED: 'success',
  PAYOUT_REJECTED: 'danger',
  DISPUTE_RESOLVED: 'gold',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, perPage: 50, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ action: '' });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        perPage: pagination.perPage.toString(),
        sortBy,
        sortDirection,
        ...(filters.action && { action: filters.action }),
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data);
        setPagination((prev) => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.perPage, filters, sortBy, sortDirection]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      sortable: true,
      render: (value) => formatDateTime(String(value)),
    },
    {
      key: 'action',
      header: 'Action',
      render: (value) => (
        <Badge variant={actionVariants[String(value)] || 'default'}>
          {String(value).replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'admin',
      header: 'Admin',
      render: (_, row) => row.admin?.username || 'System',
    },
    {
      key: 'targetType',
      header: 'Target',
      render: (_, row) => row.targetType ? `${row.targetType}:${row.targetId?.slice(0, 8)}...` : '-',
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (value) => (value as string) || '-',
    },
    {
      key: 'details',
      header: 'Details',
      render: (value) => {
        if (!value) return '-';
        const str = JSON.stringify(value);
        return <span className="text-xs text-gray-400 truncate max-w-[200px] block">{str.length > 50 ? str.slice(0, 50) + '...' : str}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-gray-400 mt-1">Track all admin actions and system events</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <select value={filters.action} onChange={(e) => setFilters({ action: e.target.value })} className="input-field max-w-[250px]">
            <option value="">All Actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          data={logs}
          loading={loading}
          pagination={pagination}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onSort={(key, dir) => { setSortBy(key); setSortDirection(dir); }}
          sortBy={sortBy}
          sortDirection={sortDirection}
          emptyMessage="No audit logs found"
        />
      </Card>
    </div>
  );
}
