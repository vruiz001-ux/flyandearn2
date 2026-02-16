'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { LineChart } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { Loading } from '@/components/ui/Loading';
import { formatNumber } from '@/lib/utils';

interface FunnelStep {
  name: string;
  count: number;
  rate: number;
}

interface FunnelData {
  acquisitionFunnel: {
    steps: FunnelStep[];
    overallConversion: number;
  };
  marketplaceFunnel: {
    steps: FunnelStep[];
    overallConversion: number;
  };
  subscriptionFunnel: {
    steps: FunnelStep[];
    abandoned: number;
    abandonRate: number;
    overallConversion: number;
  };
  trialFunnel: {
    started: number;
    converted: number;
    expired: number;
    conversionRate: number;
    dropoffRate: number;
  };
  conversionRates: {
    visitorToSignup: number;
    signupToRequest: number;
    requestToMatch: number;
    matchToComplete: number;
    visitorToSubscriber: number;
    trialConversion: number;
  };
  trafficBreakdown: {
    byDevice: Array<{ device: string; count: number; percentage: number }>;
    bySource: Array<{ source: string; count: number; percentage: number }>;
  };
  dailyTrend: Array<{
    date: string;
    visitors: number;
    signups: number;
    requests: number;
    acceptedMatches: number;
    completedMatches: number;
    subscriptions: number;
  }>;
}

export default function FunnelsPage() {
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'custom'>('30d');
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/metrics/funnels?range=${dateRange}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load funnel data');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Conversion Funnels</h1>
          <p className="text-gray-400 mt-1">Track user journey through key conversion points</p>
        </div>
        <DateRangePicker value={dateRange} onChange={(v) => setDateRange(v)} />
      </div>

      {/* Conversion Rates Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ConversionCard
          title="Visitor → Signup"
          rate={data?.conversionRates.visitorToSignup || 0}
        />
        <ConversionCard
          title="Signup → Request"
          rate={data?.conversionRates.signupToRequest || 0}
        />
        <ConversionCard
          title="Request → Match"
          rate={data?.conversionRates.requestToMatch || 0}
        />
        <ConversionCard
          title="Match → Complete"
          rate={data?.conversionRates.matchToComplete || 0}
        />
        <ConversionCard
          title="Visitor → Subscriber"
          rate={data?.conversionRates.visitorToSubscriber || 0}
        />
        <ConversionCard
          title="Trial Conversion"
          rate={data?.conversionRates.trialConversion || 0}
        />
      </div>

      {/* Main Funnels Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acquisition Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Acquisition Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelVisualization
              steps={data?.acquisitionFunnel.steps || []}
              overallConversion={data?.acquisitionFunnel.overallConversion || 0}
            />
          </CardContent>
        </Card>

        {/* Marketplace Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Marketplace Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelVisualization
              steps={data?.marketplaceFunnel.steps || []}
              overallConversion={data?.marketplaceFunnel.overallConversion || 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* Subscription and Trial Funnels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <FunnelVisualization
              steps={data?.subscriptionFunnel.steps || []}
              overallConversion={data?.subscriptionFunnel.overallConversion || 0}
            />
            {(data?.subscriptionFunnel?.abandoned ?? 0) > 0 && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">
                  {data?.subscriptionFunnel?.abandoned} checkouts abandoned
                  ({(data?.subscriptionFunnel?.abandonRate ?? 0).toFixed(1)}% abandon rate)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trial Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Trial Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-blue-400">
                    {data?.trialFunnel.started || 0}
                  </p>
                  <p className="text-sm text-gray-400">Trials Started</p>
                </div>
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-green-400">
                    {data?.trialFunnel.converted || 0}
                  </p>
                  <p className="text-sm text-gray-400">Converted</p>
                </div>
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-2xl font-bold text-red-400">
                    {data?.trialFunnel.expired || 0}
                  </p>
                  <p className="text-sm text-gray-400">Expired</p>
                </div>
              </div>

              <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-green-500"
                  style={{ width: `${data?.trialFunnel.conversionRate || 0}%` }}
                />
                <div
                  className="absolute right-0 top-0 h-full bg-red-500"
                  style={{ width: `${data?.trialFunnel.dropoffRate || 0}%` }}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-green-400">
                  {(data?.trialFunnel.conversionRate || 0).toFixed(1)}% converted
                </span>
                <span className="text-red-400">
                  {(data?.trialFunnel.dropoffRate || 0).toFixed(1)}% dropped
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Traffic by Device</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.trafficBreakdown.byDevice && data.trafficBreakdown.byDevice.length > 0 ? (
              <BarChart
                data={data.trafficBreakdown.byDevice.map(d => ({
                  name: d.device,
                  visitors: d.count,
                }))}
                bars={[{ key: 'visitors', name: 'Visitors', color: '#d4af37' }]}
                height={200}
                showLegend={false}
              />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400">
                No device data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Traffic by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.trafficBreakdown.bySource && data.trafficBreakdown.bySource.length > 0 ? (
              <div className="space-y-3">
                {data.trafficBreakdown.bySource.map((source, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-400 truncate">
                      {source.source}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold-500 rounded-full"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right text-sm">
                      <span className="text-gray-400">{formatNumber(source.count)}</span>
                      <span className="text-gray-500 ml-1">({source.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400">
                No source data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Funnel Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.dailyTrend && data.dailyTrend.length > 0 ? (
            <LineChart
              data={data.dailyTrend}
              lines={[
                { key: 'visitors', name: 'Visitors', color: '#d4af37' },
                { key: 'signups', name: 'Signups', color: '#22c55e' },
                { key: 'requests', name: 'Requests', color: '#3b82f6' },
                { key: 'completedMatches', name: 'Completed', color: '#8b5cf6' },
              ]}
              height={300}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400">
              No trend data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Conversion rate card component
function ConversionCard({ title, rate }: { title: string; rate: number }) {
  const getColor = (r: number) => {
    if (r >= 50) return 'text-green-400';
    if (r >= 20) return 'text-yellow-400';
    if (r >= 5) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-dark-800/50 border border-white/10 rounded-lg p-4">
      <p className="text-xs text-gray-400 mb-1">{title}</p>
      <p className={`text-xl font-bold ${getColor(rate)}`}>
        {rate.toFixed(1)}%
      </p>
    </div>
  );
}

// Funnel visualization component
function FunnelVisualization({
  steps,
  overallConversion,
}: {
  steps: FunnelStep[];
  overallConversion: number;
}) {
  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-gray-400">
        No funnel data available
      </div>
    );
  }

  const maxCount = steps[0]?.count || 1;

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const width = (step.count / maxCount) * 100;
        const isLast = index === steps.length - 1;

        return (
          <div key={index}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{step.name}</span>
              <span className="text-sm text-gray-400">
                {formatNumber(step.count)}
                {index > 0 && (
                  <span className="ml-2 text-xs">
                    ({step.rate.toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="relative h-8 bg-white/5 rounded overflow-hidden">
              <div
                className={`h-full rounded transition-all duration-500 ${
                  isLast ? 'bg-green-500' : 'bg-gold-500'
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
            {!isLast && (
              <div className="flex justify-center my-2">
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Overall Conversion</span>
          <span className={`text-lg font-bold ${
            overallConversion >= 10 ? 'text-green-400' :
            overallConversion >= 5 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {overallConversion.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
