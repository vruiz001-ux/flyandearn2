'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AreaChart } from '@/components/charts/AreaChart';
import { Loading } from '@/components/ui/Loading';
import { formatNumber } from '@/lib/utils';

interface HealthData {
  overall: {
    health: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  eventIngestion: {
    lastEvent: string | null;
    lastEventType: string | null;
    minutesSinceLastEvent: number | null;
    eventsLastHour: number;
    eventsLast24h: number;
    eventsLast7d: number;
    avgEventsPerDay: number;
    health: number;
    status: 'healthy' | 'warning' | 'critical';
    trend: Array<{ date: string; count: number }>;
  };
  dataQuality: {
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    missingFields: {
      sessionId: { count: number; rate: number };
      path: { count: number; rate: number };
      deviceType: { count: number; rate: number };
    };
    totalPageviews24h: number;
  };
  payouts: {
    successRate: number;
    status: 'healthy' | 'warning' | 'critical';
    failed24h: number;
    pending: number;
    total24h: number;
  };
  database: {
    users: number;
    requests: number;
    matches: number;
    wallets: number;
  };
  activity: {
    auditLogs24h: number;
    messages24h: number;
    activeAdminSessions: number;
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'critical';
    message: string;
  }>;
}

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = autoRefresh ? setInterval(fetchData, 30000) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/metrics/health');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setError('');
      } else {
        setError(result.error || 'Failed to load health data');
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
          <button onClick={fetchData} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'danger';
      default: return 'default';
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-400';
    if (health >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBgColor = (health: number) => {
    if (health >= 80) return 'bg-green-500';
    if (health >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-gray-400 mt-1">Monitor system performance and data quality</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600 bg-dark-700 text-gold-500 focus:ring-gold-500"
            />
            Auto-refresh (30s)
          </label>
          <button onClick={fetchData} className="btn-secondary text-sm">
            Refresh Now
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                alert.level === 'critical'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : alert.level === 'warning'
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {alert.level === 'critical' && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {alert.level === 'warning' && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="font-medium">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overall Health */}
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-white/10"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(data?.overall.health || 0) * 3.14} 314`}
                  className={getHealthColor(data?.overall.health || 0)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className={`text-4xl font-bold ${getHealthColor(data?.overall.health || 0)}`}>
                    {Math.round(data?.overall.health || 0)}%
                  </p>
                  <p className="text-sm text-gray-400">Overall Health</p>
                </div>
              </div>
            </div>
            <Badge
              variant={getStatusColor(data?.overall.status || 'healthy')}
              className="mt-4"
            >
              {data?.overall.status?.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthCard
          title="Event Ingestion"
          value={`${Math.round(data?.eventIngestion.health || 0)}%`}
          status={data?.eventIngestion.status || 'healthy'}
          detail={`${data?.eventIngestion.eventsLastHour || 0} events/hour`}
        />
        <HealthCard
          title="Data Quality"
          value={`${Math.round(data?.dataQuality.score || 0)}%`}
          status={data?.dataQuality.status || 'healthy'}
          detail={`${data?.dataQuality.totalPageviews24h || 0} pageviews/24h`}
        />
        <HealthCard
          title="Payout Success"
          value={`${(data?.payouts.successRate || 100).toFixed(1)}%`}
          status={data?.payouts.status || 'healthy'}
          detail={`${data?.payouts.failed24h || 0} failed/24h`}
        />
        <HealthCard
          title="Last Event"
          value={data?.eventIngestion?.minutesSinceLastEvent != null
            ? `${data.eventIngestion.minutesSinceLastEvent}m ago`
            : 'N/A'
          }
          status={
            data?.eventIngestion?.minutesSinceLastEvent != null
              ? (data.eventIngestion.minutesSinceLastEvent < 60 ? 'healthy' : 'warning')
              : 'critical'
          }
          detail={data?.eventIngestion?.lastEventType || 'No events'}
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Ingestion */}
        <Card>
          <CardHeader>
            <CardTitle>Event Ingestion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xl font-bold">{formatNumber(data?.eventIngestion.eventsLastHour || 0)}</p>
                  <p className="text-xs text-gray-400">Last Hour</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xl font-bold">{formatNumber(data?.eventIngestion.eventsLast24h || 0)}</p>
                  <p className="text-xs text-gray-400">Last 24h</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xl font-bold">{formatNumber(data?.eventIngestion.avgEventsPerDay || 0)}</p>
                  <p className="text-xs text-gray-400">Avg/Day</p>
                </div>
              </div>

              {data?.eventIngestion.trend && data.eventIngestion.trend.length > 0 && (
                <AreaChart
                  data={data.eventIngestion.trend}
                  dataKey="count"
                  color="#d4af37"
                  height={150}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Quality */}
        <Card>
          <CardHeader>
            <CardTitle>Data Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Overall Score</span>
                <span className={`text-2xl font-bold ${getHealthColor(data?.dataQuality.score || 0)}`}>
                  {Math.round(data?.dataQuality.score || 0)}%
                </span>
              </div>

              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getHealthBgColor(data?.dataQuality.score || 0)}`}
                  style={{ width: `${data?.dataQuality.score || 0}%` }}
                />
              </div>

              <div className="space-y-3 pt-4">
                <p className="text-sm font-medium text-gray-400">Missing Fields (24h)</p>
                <DataQualityRow
                  label="Session ID"
                  count={data?.dataQuality.missingFields.sessionId.count || 0}
                  rate={data?.dataQuality.missingFields.sessionId.rate || 0}
                />
                <DataQualityRow
                  label="Path"
                  count={data?.dataQuality.missingFields.path.count || 0}
                  rate={data?.dataQuality.missingFields.path.rate || 0}
                />
                <DataQualityRow
                  label="Device Type"
                  count={data?.dataQuality.missingFields.deviceType.count || 0}
                  rate={data?.dataQuality.missingFields.deviceType.rate || 0}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payouts and Database */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payouts */}
        <Card>
          <CardHeader>
            <CardTitle>Payout Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Success Rate</span>
                <span className={`text-2xl font-bold ${
                  (data?.payouts.successRate || 100) >= 95 ? 'text-green-400' :
                  (data?.payouts.successRate || 100) >= 80 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {(data?.payouts.successRate || 100).toFixed(1)}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <p className="text-xl font-bold">{data?.payouts.total24h || 0}</p>
                  <p className="text-xs text-gray-400">Total (24h)</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <p className="text-xl font-bold text-yellow-400">{data?.payouts.pending || 0}</p>
                  <p className="text-xs text-gray-400">Pending</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-400">{data?.payouts.failed24h || 0}</p>
                  <p className="text-xs text-gray-400">Failed (24h)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Database Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-2xl font-bold">{formatNumber(data?.database.users || 0)}</p>
                <p className="text-sm text-gray-400">Users</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-2xl font-bold">{formatNumber(data?.database.requests || 0)}</p>
                <p className="text-sm text-gray-400">Requests</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-2xl font-bold">{formatNumber(data?.database.matches || 0)}</p>
                <p className="text-sm text-gray-400">Matches</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-2xl font-bold">{formatNumber(data?.database.wallets || 0)}</p>
                <p className="text-sm text-gray-400">Wallets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white/5 rounded-lg flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.activity.auditLogs24h || 0}</p>
                <p className="text-sm text-gray-400">Audit Logs (24h)</p>
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.activity.messages24h || 0}</p>
                <p className="text-sm text-gray-400">Messages (24h)</p>
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg flex items-center gap-4">
              <div className="p-3 bg-gold-500/20 rounded-lg">
                <svg className="w-6 h-6 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.activity.activeAdminSessions || 0}</p>
                <p className="text-sm text-gray-400">Active Admin Sessions</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Health card component
function HealthCard({
  title,
  value,
  status,
  detail,
}: {
  title: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  detail: string;
}) {
  const getStatusBg = (s: string) => {
    switch (s) {
      case 'healthy': return 'border-green-500/20 bg-green-500/5';
      case 'warning': return 'border-yellow-500/20 bg-yellow-500/5';
      case 'critical': return 'border-red-500/20 bg-red-500/5';
      default: return 'border-white/10 bg-white/5';
    }
  };

  const getStatusText = (s: string) => {
    switch (s) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getStatusBg(status)}`}>
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${getStatusText(status)}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{detail}</p>
    </div>
  );
}

// Data quality row component
function DataQualityRow({
  label,
  count,
  rate,
}: {
  label: string;
  count: number;
  rate: number;
}) {
  const getColor = (r: number) => {
    if (r <= 5) return 'text-green-400';
    if (r <= 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-gray-500">{count} missing</span>
        <span className={`font-medium ${getColor(rate)}`}>
          {rate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
