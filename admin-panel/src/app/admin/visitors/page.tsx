'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { DataTable, Column } from '@/components/tables/DataTable';
import { Loading } from '@/components/ui/Loading';
import { formatNumber } from '@/lib/utils';

interface DailyStats {
  date: string;
  totalVisits: number;
  uniqueVisitors: number;
  pageviews: number;
  newSignups: number;
  [key: string]: string | number;
}

export default function VisitorsPage() {
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DailyStats[]>([]);
  const [totals, setTotals] = useState({ visits: 0, unique: 0, pageviews: 0, signups: 0 });

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/dashboard?range=${dateRange}`);
      const data = await response.json();
      if (data.success) {
        const chartData = data.data.charts.visitors.map((d: any) => ({
          date: d.date,
          totalVisits: d.visits,
          uniqueVisitors: d.unique,
          pageviews: d.pageviews,
          newSignups: d.signups,
        }));
        setStats(chartData);
        setTotals({
          visits: data.data.kpis.visitors.total,
          unique: data.data.kpis.visitors.unique,
          pageviews: data.data.kpis.visitors.pageviews,
          signups: data.data.kpis.users.newSignups,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<DailyStats>[] = [
    { key: 'date', header: 'Date', render: (v) => String(v) },
    { key: 'totalVisits', header: 'Total Visits', render: (v) => formatNumber(Number(v)) },
    { key: 'uniqueVisitors', header: 'Unique Visitors', render: (v) => formatNumber(Number(v)) },
    { key: 'pageviews', header: 'Pageviews', render: (v) => formatNumber(Number(v)) },
    { key: 'newSignups', header: 'New Signups', render: (v) => String(v ?? 0) },
  ];

  if (loading && stats.length === 0) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loading size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Visitors & Analytics</h1>
          <p className="text-gray-400 mt-1">Site traffic and engagement metrics</p>
        </div>
        <DateRangePicker value={dateRange} onChange={(v) => setDateRange(v)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Visits" value={formatNumber(totals.visits)} icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
        <KPICard title="Unique Visitors" value={formatNumber(totals.unique)} />
        <KPICard title="Pageviews" value={formatNumber(totals.pageviews)} />
        <KPICard title="New Signups" value={totals.signups} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Visitors Trend</CardTitle></CardHeader>
          <CardContent>
            {stats.length > 0 ? (
              <LineChart
                data={stats}
                lines={[
                  { key: 'totalVisits', name: 'Total Visits', color: '#d4af37' },
                  { key: 'uniqueVisitors', name: 'Unique Visitors', color: '#22c55e' },
                ]}
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">No data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pageviews & Signups</CardTitle></CardHeader>
          <CardContent>
            {stats.length > 0 ? (
              <BarChart
                data={stats.map(d => ({ name: d.date, pageviews: d.pageviews, signups: d.newSignups * 10 }))}
                bars={[
                  { key: 'pageviews', name: 'Pageviews', color: '#3b82f6' },
                  { key: 'signups', name: 'Signups (x10)', color: '#8b5cf6' },
                ]}
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Daily Statistics</CardTitle></CardHeader>
        <DataTable
          columns={columns}
          data={stats}
          loading={loading}
          emptyMessage="No data available"
        />
      </Card>
    </div>
  );
}
