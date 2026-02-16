'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { Loading } from '@/components/ui/Loading';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface DashboardData {
  kpis: {
    visitors: { total: number; unique: number; pageviews: number; change: number };
    users: { total: number; newSignups: number; verified: number; change: number };
    requests: { total: number; open: number; completed: number; change: number };
    matches: { total: number; accepted: number; completed: number; acceptanceRate: number };
    financial: { gmv: number; platformFees: number; totalPayouts: number; pendingPayouts: number; avgOrderValue: number };
    wallet: { totalBalance: number; totalHeld: number; pendingPayoutsCount: number };
    messages: { conversations: number; messagesInPeriod: number; messagesPerDay: number };
    disputes: { open: number; resolved: number; totalRefunds: number };
  };
  charts: {
    visitors: Array<{ date: string; visits: number; unique: number; pageviews: number; signups: number; requests: number; gmv: number }>;
    geo: Array<{ country: string; count: number }>;
  };
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, [dateRange]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/dashboard?range=${dateRange}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchDashboard} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis;
  const charts = data?.charts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-1">Overview of your marketplace performance</p>
        </div>
        <DateRangePicker value={dateRange} onChange={(v) => setDateRange(v)} />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Visitors"
          value={formatNumber(kpis?.visitors.total || 0)}
          change={kpis?.visitors.change}
          trend={kpis?.visitors.change ? (kpis.visitors.change > 0 ? 'up' : 'down') : 'neutral'}
          changeLabel="vs previous period"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <KPICard
          title="Total Users"
          value={formatNumber(kpis?.users.total || 0)}
          change={kpis?.users.change}
          trend={kpis?.users.change ? (kpis.users.change > 0 ? 'up' : 'down') : 'neutral'}
          changeLabel={`${kpis?.users.newSignups || 0} new signups`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <KPICard
          title="Total Requests"
          value={formatNumber(kpis?.requests.total || 0)}
          change={kpis?.requests.change}
          trend={kpis?.requests.change ? (kpis.requests.change > 0 ? 'up' : 'down') : 'neutral'}
          changeLabel={`${kpis?.requests.open || 0} open`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <KPICard
          title="GMV"
          value={formatCurrency(kpis?.financial.gmv || 0)}
          changeLabel={`Avg order: ${formatCurrency(kpis?.financial.avgOrderValue || 0)}`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Acceptance Rate"
          value={`${(kpis?.matches.acceptanceRate || 0).toFixed(1)}%`}
          changeLabel={`${kpis?.matches.accepted || 0} accepted`}
        />
        <KPICard
          title="Platform Fees"
          value={formatCurrency(kpis?.financial.platformFees || 0)}
          changeLabel="collected"
        />
        <KPICard
          title="Wallet Balance"
          value={formatCurrency(kpis?.wallet.totalBalance || 0)}
          changeLabel={`${formatCurrency(kpis?.wallet.totalHeld || 0)} held`}
        />
        <KPICard
          title="Open Disputes"
          value={kpis?.disputes.open || 0}
          changeLabel={`${kpis?.disputes.resolved || 0} resolved`}
          trend={kpis?.disputes.open && kpis.disputes.open > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitors Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Visitors Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.visitors && charts.visitors.length > 0 ? (
              <LineChart
                data={charts.visitors}
                lines={[
                  { key: 'visits', name: 'Total Visits', color: '#d4af37' },
                  { key: 'unique', name: 'Unique Visitors', color: '#22c55e' },
                ]}
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signups & Requests Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.visitors && charts.visitors.length > 0 ? (
              <LineChart
                data={charts.visitors}
                lines={[
                  { key: 'signups', name: 'Signups', color: '#3b82f6' },
                  { key: 'requests', name: 'New Requests', color: '#8b5cf6' },
                ]}
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Geographic Distribution */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Top Countries</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.geo && charts.geo.length > 0 ? (
              <div className="space-y-3">
                {charts.geo.slice(0, 8).map((item, index) => {
                  const maxCount = charts.geo[0]?.count || 1;
                  const percentage = (item.count / maxCount) * 100;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-20 text-sm text-gray-400 truncate">
                        {item.country}
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-12 text-right text-sm text-gray-400">
                        {item.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400">Total GMV</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(kpis?.financial.gmv || 0)}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400">Platform Fees</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(kpis?.financial.platformFees || 0)}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400">Total Payouts</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(kpis?.financial.totalPayouts || 0)}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-sm text-gray-400">Pending Payouts</p>
                <p className="text-xl font-bold mt-1 text-yellow-400">{formatCurrency(kpis?.financial.pendingPayouts || 0)}</p>
              </div>
            </div>

            {/* GMV Chart */}
            <div className="mt-6">
              {charts?.visitors && charts.visitors.length > 0 ? (
                <BarChart
                  data={charts.visitors.map(d => ({ name: d.date, gmv: d.gmv }))}
                  bars={[{ key: 'gmv', name: 'GMV', color: '#d4af37' }]}
                  height={200}
                  showLegend={false}
                />
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Completed Deals</p>
          <p className="text-lg font-bold">{kpis?.matches.completed || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Verified Users</p>
          <p className="text-lg font-bold">{kpis?.users.verified || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Conversations</p>
          <p className="text-lg font-bold">{kpis?.messages.conversations || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Msgs/Day</p>
          <p className="text-lg font-bold">{kpis?.messages.messagesPerDay || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Total Refunds</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(kpis?.disputes.totalRefunds || 0)}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Pageviews</p>
          <p className="text-lg font-bold">{formatNumber(kpis?.visitors.pageviews || 0)}</p>
        </div>
      </div>
    </div>
  );
}
