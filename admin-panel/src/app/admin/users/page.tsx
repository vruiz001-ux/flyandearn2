'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { DataTable, Column, exportToCSV } from '@/components/tables/DataTable';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  location: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  walletBalance: number;
  requestCount: number;
  matchCount: number;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    role: '',
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionModal, setActionModal] = useState<'suspend' | 'resetWallet' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        perPage: pagination.perPage.toString(),
        sortBy,
        sortDirection,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.role && { role: filters.role }),
      });

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.perPage, filters, sortBy, sortDirection]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleAction = async () => {
    if (!selectedUser || !actionModal) return;

    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: actionModal === 'suspend' && selectedUser.status === 'SUSPENDED'
            ? 'unsuspend'
            : actionModal,
          reason: actionReason,
        }),
      });

      if (response.ok) {
        fetchUsers();
        setActionModal(null);
        setSelectedUser(null);
        setActionReason('');
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    exportToCSV(users, columns, 'users-export');
  };

  const columns: Column<User>[] = [
    {
      key: 'email',
      header: 'User',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.displayName || `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Unknown'}</p>
          <p className="text-xs text-gray-400">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (value) => (
        <Badge variant={value === 'TRAVELLER' ? 'info' : value === 'BOTH' ? 'gold' : 'default'}>
          {String(value)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={String(value)} />,
    },
    {
      key: 'emailVerified',
      header: 'Verified',
      render: (value) => (
        <span className={value ? 'text-green-400' : 'text-gray-400'}>
          {value ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (value) => (value as string) || '-',
    },
    {
      key: 'walletBalance',
      header: 'Wallet',
      sortable: true,
      render: (value) => formatCurrency(Number(value)),
    },
    {
      key: 'requestCount',
      header: 'Requests',
      render: (value) => String(value ?? 0),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (value) => (
        <span title={formatDateTime(String(value))}>
          {formatRelativeTime(String(value))}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/admin/users/${row.id}`);
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded"
            title="View Details"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedUser(row);
              setActionModal('suspend');
            }}
            className={`p-1.5 hover:bg-white/10 rounded ${row.status === 'SUSPENDED' ? 'text-green-400' : 'text-yellow-400'}`}
            title={row.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-400 mt-1">Manage user accounts and profiles</p>
        </div>
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="input-field max-w-xs"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="input-field max-w-[150px]"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING_VERIFICATION">Pending</option>
            </select>
            <select
              value={filters.role}
              onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
              className="input-field max-w-[150px]"
            >
              <option value="">All Roles</option>
              <option value="REQUESTER">Requester</option>
              <option value="TRAVELLER">Traveller</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onSort={handleSort}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
          emptyMessage="No users found"
        />
      </Card>

      {/* Action Modal */}
      {actionModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {actionModal === 'suspend' && selectedUser.status === 'SUSPENDED'
                ? 'Unsuspend User'
                : actionModal === 'suspend'
                ? 'Suspend User'
                : 'Reset Wallet'}
            </h3>
            <p className="text-gray-400 mb-4">
              {actionModal === 'suspend' && selectedUser.status === 'SUSPENDED'
                ? `Are you sure you want to unsuspend ${selectedUser.displayName || selectedUser.email}?`
                : actionModal === 'suspend'
                ? `Are you sure you want to suspend ${selectedUser.displayName || selectedUser.email}?`
                : `Are you sure you want to reset the wallet for ${selectedUser.displayName || selectedUser.email}? This will set the balance to 0.`}
            </p>
            {actionModal === 'suspend' && selectedUser.status !== 'SUSPENDED' && (
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Reason for suspension..."
                className="input-field mb-4"
                rows={3}
              />
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setActionModal(null);
                  setSelectedUser(null);
                  setActionReason('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className={actionModal === 'resetWallet' ? 'btn-danger' : 'btn-primary'}
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
