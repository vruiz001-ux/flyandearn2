import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-3',
  lg: 'w-12 h-12 border-4',
};

export function Loading({ size = 'md', className }: LoadingProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-white/20 border-t-gold-500',
        sizeClasses[size],
        className
      )}
    />
  );
}

export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-dark-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <Loading size="lg" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Loading size="lg" />
        <p className="text-gray-400">Loading data...</p>
      </div>
    </div>
  );
}

export function LoadingRow() {
  return (
    <tr className="animate-pulse">
      <td colSpan={100} className="px-4 py-8">
        <div className="flex items-center justify-center">
          <Loading size="sm" />
          <span className="ml-2 text-sm text-gray-400">Loading...</span>
        </div>
      </td>
    </tr>
  );
}
