import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-500/20 text-gray-300',
  success: 'bg-green-500/20 text-green-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-blue-500/20 text-blue-400',
  gold: 'bg-gold-500/20 text-gold-500',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Status badge with predefined mappings
interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusVariants: Record<string, BadgeVariant> = {
  // User status
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  PENDING_VERIFICATION: 'warning',
  DELETED: 'default',

  // Request status
  DRAFT: 'default',
  OPEN: 'info',
  ACCEPTED: 'gold',
  IN_PROGRESS: 'warning',
  DELIVERED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'default',
  DISPUTED: 'danger',

  // Match status
  PENDING: 'warning',
  REJECTED: 'danger',
  PURCHASED: 'info',
  SHIPPED: 'info',

  // Transaction status
  FAILED: 'danger',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusVariants[status] || 'default';
  const displayStatus = status.replace(/_/g, ' ');

  return (
    <Badge variant={variant} className={className}>
      {displayStatus}
    </Badge>
  );
}
