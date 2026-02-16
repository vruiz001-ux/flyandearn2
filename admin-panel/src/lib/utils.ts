import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import crypto from 'crypto';

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number | string, currency: string = 'EUR'): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
  }).format(numAmount);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string, formatStr: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM d, yyyy HH:mm');
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Get date range based on preset
 */
export function getDateRange(preset: 'today' | '7d' | '30d' | '90d' | 'all'): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = endOfDay(new Date());

  switch (preset) {
    case 'today':
      return { startDate: startOfDay(new Date()), endDate };
    case '7d':
      return { startDate: startOfDay(subDays(new Date(), 7)), endDate };
    case '30d':
      return { startDate: startOfDay(subDays(new Date(), 30)), endDate };
    case '90d':
      return { startDate: startOfDay(subDays(new Date(), 90)), endDate };
    case 'all':
      return { startDate: new Date(0), endDate };
    default:
      return { startDate: startOfDay(subDays(new Date(), 30)), endDate };
  }
}

/**
 * Mask email for privacy
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const maskedLocal = local.length > 3
    ? `${local.slice(0, 2)}***${local.slice(-1)}`
    : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number for privacy
 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

/**
 * Mask address for privacy
 */
export function maskAddress(address: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string {
  const parts = [address.city, address.country].filter(Boolean);
  return parts.join(', ') || 'Not provided';
}

/**
 * Hash IP address for anonymization
 */
export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Generate random ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Paginate array
 */
export function paginate<T>(
  array: T[],
  page: number,
  perPage: number
): {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
} {
  const total = array.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const end = start + perPage;

  return {
    data: array.slice(start, end),
    total,
    page,
    perPage,
    totalPages,
  };
}

/**
 * Build CSV from data
 */
export function buildCSV(data: Record<string, unknown>[], columns?: string[]): string {
  if (data.length === 0) return '';

  const headers = columns || Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Escape quotes and wrap in quotes if contains comma or quote
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Parse sort parameter from query string
 */
export function parseSort(sort: string | null): {
  field: string;
  direction: 'asc' | 'desc';
} | null {
  if (!sort) return null;
  const [field, direction] = sort.split(':');
  if (!field) return null;
  return {
    field,
    direction: direction === 'desc' ? 'desc' : 'asc',
  };
}

/**
 * Sleep helper for testing/debugging
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Calculate percentage change
 */
export function calculateChange(current: number, previous: number): {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'neutral';
} {
  if (previous === 0) {
    return {
      value: current,
      percentage: current > 0 ? 100 : 0,
      direction: current > 0 ? 'up' : 'neutral',
    };
  }

  const change = current - previous;
  const percentage = (change / previous) * 100;

  return {
    value: change,
    percentage: Math.abs(percentage),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
  };
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Status color mapping
 */
export const statusColors: Record<string, string> = {
  // User status
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
  DELETED: 'bg-gray-100 text-gray-800',

  // Request status
  DRAFT: 'bg-gray-100 text-gray-800',
  OPEN: 'bg-blue-100 text-blue-800',
  ACCEPTED: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  DISPUTED: 'bg-orange-100 text-orange-800',

  // Match status
  PENDING: 'bg-yellow-100 text-yellow-800',
  REJECTED: 'bg-red-100 text-red-800',
  PURCHASED: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',

  // Transaction status
  FAILED: 'bg-red-100 text-red-800',
};
