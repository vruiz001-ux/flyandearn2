import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  className,
}: KPICardProps) {
  const trendColor = trend === 'up'
    ? 'text-green-400'
    : trend === 'down'
    ? 'text-red-400'
    : 'text-gray-400';

  const trendBg = trend === 'up'
    ? 'bg-green-500/10'
    : trend === 'down'
    ? 'bg-red-500/10'
    : 'bg-gray-500/10';

  return (
    <div className={cn('bg-dark-800/50 border border-white/10 rounded-xl p-6', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {icon && (
          <div className="p-3 bg-gold-500/10 rounded-lg">
            <span className="text-gold-500">{icon}</span>
          </div>
        )}
      </div>
      {(change !== undefined || changeLabel) && (
        <div className="mt-4 flex items-center gap-2">
          {change !== undefined && (
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', trendColor, trendBg)}>
              {trend === 'up' && '+'}
              {change.toFixed(1)}%
            </span>
          )}
          {changeLabel && (
            <span className="text-xs text-gray-400">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
