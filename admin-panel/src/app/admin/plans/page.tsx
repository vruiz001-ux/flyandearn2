'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { KPICard } from '@/components/ui/KPICard';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { AreaChart } from '@/components/charts/AreaChart';
import { Badge } from '@/components/ui/Badge';
import { Loading } from '@/components/ui/Loading';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  tier: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  trialDays: number;
  isActive: boolean;
  subscribers: number;
  mrr: number;
}

interface SubscriptionData {
  summary: {
    mrr: number;
    arr: number;
    arpu: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    totalSubscribers: number;
    churnRate: number;
    trialConversionRate: number;
  };
  period: {
    newSubscriptions: number;
    cancellations: number;
    upgrades: number;
    downgrades: number;
    renewals: number;
    trialStarts: number;
    trialConversions: number;
    trialExpiries: number;
    expansionMrr: number;
    contractionMrr: number;
    churnedMrr: number;
    netMrrChange: number;
    prevNewSubscriptions: number;
    newSubsChange: number;
  };
  plans: Plan[];
  revenueByPlan: Array<{ planId: string; planName: string; tier: string; subscribers: number; mrr: number }>;
  charts: {
    subscriptions: Array<{
      date: string;
      newSubscriptions: number;
      cancellations: number;
      trialStarts: number;
      trialConversions: number;
      mrr: number;
      netMrr: number;
    }>;
    mrrTrend: Array<{ date: string; mrr: number; netMrr: number }>;
  };
  cohortRetention: Array<{
    cohort: string;
    total: number;
    week1: number;
    week4: number;
    week8: number;
    week12: number;
  }>;
}

export default function PlansAnalyticsPage() {
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/subscriptions/analytics?range=${dateRange}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load subscription analytics');
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

  const summary = data?.summary;
  const period = data?.period;
  const charts = data?.charts;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'FREE': return 'default';
      case 'BASIC': return 'info';
      case 'PRO': return 'warning';
      case 'ENTERPRISE': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plans & Subscriptions</h1>
          <p className="text-gray-400 mt-1">SaaS metrics, MRR, churn, and cohort retention</p>
        </div>
        <DateRangePicker value={dateRange} onChange={(v) => setDateRange(v)} />
      </div>

      {/* Key SaaS Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="MRR"
          value={formatCurrency(summary?.mrr || 0)}
          changeLabel={`ARR: ${formatCurrency(summary?.arr || 0)}`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KPICard
          title="Active Subscribers"
          value={formatNumber(summary?.totalSubscribers || 0)}
          change={period?.newSubsChange}
          trend={period?.newSubsChange ? (period.newSubsChange > 0 ? 'up' : 'down') : 'neutral'}
          changeLabel={`${summary?.trialingSubscriptions || 0} trialing`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <KPICard
          title="Churn Rate"
          value={`${(summary?.churnRate || 0).toFixed(1)}%`}
          trend={summary?.churnRate && summary.churnRate > 5 ? 'down' : 'up'}
          changeLabel={`${period?.cancellations || 0} cancelled this period`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          }
        />
        <KPICard
          title="Trial Conversion"
          value={`${(summary?.trialConversionRate || 0).toFixed(1)}%`}
          changeLabel={`${period?.trialConversions || 0} of ${period?.trialStarts || 0} trials`}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="ARPU"
          value={formatCurrency(summary?.arpu || 0)}
          changeLabel="per subscriber"
        />
        <KPICard
          title="Expansion MRR"
          value={formatCurrency(period?.expansionMrr || 0)}
          changeLabel={`${period?.upgrades || 0} upgrades`}
          trend="up"
        />
        <KPICard
          title="Contraction MRR"
          value={formatCurrency(period?.contractionMrr || 0)}
          changeLabel={`${period?.downgrades || 0} downgrades`}
          trend="down"
        />
        <KPICard
          title="Churned MRR"
          value={formatCurrency(period?.churnedMrr || 0)}
          changeLabel="from cancellations"
          trend="down"
        />
        <KPICard
          title="Net MRR Change"
          value={formatCurrency(period?.netMrrChange || 0)}
          trend={period?.netMrrChange ? (period.netMrrChange > 0 ? 'up' : 'down') : 'neutral'}
          changeLabel="this period"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR Trend */}
        <Card>
          <CardHeader>
            <CardTitle>MRR Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.mrrTrend && charts.mrrTrend.length > 0 ? (
              <AreaChart
                data={charts.mrrTrend}
                dataKey="mrr"
                color="#d4af37"
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscriptions Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.subscriptions && charts.subscriptions.length > 0 ? (
              <LineChart
                data={charts.subscriptions}
                lines={[
                  { key: 'newSubscriptions', name: 'New Subs', color: '#22c55e' },
                  { key: 'cancellations', name: 'Cancellations', color: '#ef4444' },
                  { key: 'trialConversions', name: 'Trial Conversions', color: '#3b82f6' },
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

      {/* Plans and Cohort Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plans Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Plans Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.plans && data.plans.length > 0 ? (
                data.plans.map((plan) => (
                  <div key={plan.id} className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{plan.name}</h3>
                        <Badge variant={getTierColor(plan.tier)}>{plan.tier}</Badge>
                        {!plan.isActive && <Badge variant="danger">Inactive</Badge>}
                      </div>
                      <span className="text-lg font-bold">
                        {formatCurrency(plan.monthlyPrice)}/mo
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-400">Subscribers</p>
                        <p className="font-semibold">{plan.subscribers}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">MRR</p>
                        <p className="font-semibold text-gold-400">{formatCurrency(plan.mrr)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Trial Days</p>
                        <p className="font-semibold">{plan.trialDays || 'None'}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No plans configured
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.revenueByPlan && data.revenueByPlan.length > 0 ? (
              <>
                <BarChart
                  data={data.revenueByPlan.map(p => ({
                    name: p.planName,
                    mrr: p.mrr,
                  }))}
                  bars={[{ key: 'mrr', name: 'MRR', color: '#d4af37' }]}
                  height={200}
                  showLegend={false}
                />
                <div className="mt-4 space-y-2">
                  {data.revenueByPlan.map((plan, index) => {
                    const totalMrr = data.revenueByPlan.reduce((sum, p) => sum + p.mrr, 0);
                    const percentage = totalMrr > 0 ? (plan.mrr / totalMrr) * 100 : 0;
                    return (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={getTierColor(plan.tier)}>{plan.tier}</Badge>
                          <span>{plan.planName}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-400">{plan.subscribers} subs</span>
                          <span className="font-semibold">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cohort Retention Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cohort Retention</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.cohortRetention && data.cohortRetention.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-400">
                    <th className="pb-3 font-medium">Cohort</th>
                    <th className="pb-3 font-medium text-right">Subscribers</th>
                    <th className="pb-3 font-medium text-right">Week 1</th>
                    <th className="pb-3 font-medium text-right">Week 4</th>
                    <th className="pb-3 font-medium text-right">Week 8</th>
                    <th className="pb-3 font-medium text-right">Week 12</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.cohortRetention.map((cohort, index) => (
                    <tr key={index}>
                      <td className="py-3 font-medium">{cohort.cohort}</td>
                      <td className="py-3 text-right text-gray-400">{cohort.total}</td>
                      <td className="py-3 text-right">
                        <RetentionCell value={cohort.week1} />
                      </td>
                      <td className="py-3 text-right">
                        <RetentionCell value={cohort.week4} />
                      </td>
                      <td className="py-3 text-right">
                        <RetentionCell value={cohort.week8} />
                      </td>
                      <td className="py-3 text-right">
                        <RetentionCell value={cohort.week12} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              Not enough data for cohort analysis
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Activity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">New Subscriptions</p>
          <p className="text-lg font-bold text-green-400">{period?.newSubscriptions || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Cancellations</p>
          <p className="text-lg font-bold text-red-400">{period?.cancellations || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Upgrades</p>
          <p className="text-lg font-bold text-blue-400">{period?.upgrades || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Downgrades</p>
          <p className="text-lg font-bold text-yellow-400">{period?.downgrades || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Trial Starts</p>
          <p className="text-lg font-bold">{period?.trialStarts || 0}</p>
        </div>
        <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400">Trial Expiries</p>
          <p className="text-lg font-bold text-gray-400">{period?.trialExpiries || 0}</p>
        </div>
      </div>
    </div>
  );
}

// Helper component for retention cells
function RetentionCell({ value }: { value: number }) {
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-green-500/20 text-green-400';
    if (v >= 60) return 'bg-yellow-500/20 text-yellow-400';
    if (v >= 40) return 'bg-orange-500/20 text-orange-400';
    return 'bg-red-500/20 text-red-400';
  };

  return (
    <span className={`px-2 py-1 rounded text-sm ${getColor(value)}`}>
      {value.toFixed(0)}%
    </span>
  );
}
