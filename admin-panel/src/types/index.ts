// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination types
export interface PaginationParams {
  page: number;
  perPage: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

// Dashboard types
export interface DashboardKPIs {
  visitors: {
    total: number;
    unique: number;
    pageviews: number;
    change: number;
  };
  users: {
    total: number;
    newSignups: number;
    verified: number;
    change: number;
  };
  requests: {
    total: number;
    open: number;
    completed: number;
    change: number;
  };
  matches: {
    total: number;
    accepted: number;
    completed: number;
    acceptanceRate: number;
  };
  financial: {
    gmv: number;
    platformFees: number;
    totalPayouts: number;
    pendingPayouts: number;
    avgOrderValue: number;
  };
  wallet: {
    totalBalance: number;
    totalHeld: number;
    totalPayouts: number;
    pendingPayouts: number;
  };
  messages: {
    conversations: number;
    messagesPerDay: number;
    medianResponseTime: number;
  };
  disputes: {
    open: number;
    resolved: number;
    avgResolutionTime: number;
    totalRefunds: number;
  };
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface GeoDataPoint {
  country: string;
  city?: string;
  count: number;
  percentage: number;
}

// Date range types
export type DateRangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Filter types
export interface UserFilters {
  search?: string;
  status?: string;
  role?: string;
  verified?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface RequestFilters {
  search?: string;
  status?: string;
  category?: string;
  destination?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface TransactionFilters {
  search?: string;
  type?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Action types
export interface AdminAction {
  type: string;
  targetId: string;
  reason?: string;
  newValue?: unknown;
}

// Export types
export interface ExportOptions {
  format: 'csv' | 'json';
  fields?: string[];
  dateRange?: DateRange;
  filters?: Record<string, unknown>;
}

// Table column definition
export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
}

// Form validation
export interface ValidationError {
  field: string;
  message: string;
}

// User summary for lists
export interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: Date;
  walletBalance: number;
  city: string | null;
  country: string | null;
}

// Request summary for lists
export interface RequestSummary {
  id: string;
  title: string;
  category: string;
  status: string;
  itemPrice: number;
  commission: number;
  currency: string;
  pickupCountry: string;
  deliveryCountry: string;
  createdAt: Date;
  requester: {
    id: string;
    displayName: string | null;
    email: string;
  };
  matchCount: number;
}

// Match summary for lists
export interface MatchSummary {
  id: string;
  status: string;
  agreedPrice: number | null;
  commission: number | null;
  createdAt: Date;
  request: {
    id: string;
    title: string;
    status: string;
  };
  traveller: {
    id: string;
    displayName: string | null;
    email: string;
  };
}

// Transaction summary for lists
export interface TransactionSummary {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: Date;
  user: {
    id: string;
    displayName: string | null;
    email: string;
  };
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
  admin: {
    id: string;
    username: string;
  } | null;
}
