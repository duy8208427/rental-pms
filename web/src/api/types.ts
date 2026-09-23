export type UserRole = "admin" | "manager" | "tenant";
export type PropertyType = "office" | "hotel" | "workshop" | "mixed";
export type UnitStatus =
  | "vacant"
  | "reserved"
  | "occupied"
  | "checkout_today"
  | "maintenance"
  | "overdue";
export type OccupancyKind = "booking" | "contract";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  id_number?: string | null;
  role: UserRole;
  tenant_id?: string | null;
  managed_property_id?: string | null;
  managed_property_name?: string | null;
  is_active?: boolean;
}

export interface Property {
  id: string;
  name: string;
  property_type: PropertyType;
  address?: string | null;
  city?: string | null;
  floors: number;
}

export interface Unit {
  id: string;
  property_id: string;
  code: string;
  name: string;
  unit_type: string;
  floor: number;
  area_m2?: number | null;
  capacity: number;
  price_per_night?: number | null;
  price_per_month?: number | null;
  price_per_hour?: number | null;
  notes?: string | null;
  display_status?: UnitStatus;
}

export interface Tenant {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  id_number?: string | null;
}

export interface RoomBoardUnit {
  id: string;
  code: string;
  name: string;
  floor: number;
  unit_type: string;
  capacity: number;
  price_per_night?: number | null;
  price_per_month?: number | null;
  price_per_hour?: number | null;
  notes?: string | null;
  display_status: UnitStatus;
  tenant_name?: string | null;
  occupancy_id?: string | null;
  occupancy_kind?: OccupancyKind | null;
  end_date?: string | null;
  balance_due: number;
}

export interface CalendarBlock {
  occupancy_id: string;
  unit_id: string;
  unit_code: string;
  tenant_name: string;
  kind: OccupancyKind;
  status: string;
  start_date: string;
  end_date: string;
}

export interface Dashboard {
  total_units: number;
  vacant_units: number;
  occupied_units: number;
  reserved_units: number;
  maintenance_units: number;
  occupancy_rate: number;
  revenue_month: number;
  expense_month: number;
  overdue_invoices: number;
  overdue_amount: number;
  checkouts_today: number;
  contracts_expiring_30d: number;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  tenant_id: string;
  tenant_name?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  unit_code?: string | null;
  amount: number;
  paid_amount: number;
  balance?: number;
  status: string;
  issue_date: string;
  due_date: string;
  description?: string | null;
}

export interface Contract {
  id: string;
  contract_no: string;
  deposit: number;
  monthly_rent: number;
  billing_cycle: string;
  occupancy?: {
    unit_code?: string;
    tenant_name?: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
}

export interface Booking {
  id: string;
  guests: number;
  adults?: number;
  children?: number;
  rate_per_night: number;
  total_amount: number;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  occupancy?: {
    unit_code?: string;
    tenant_name?: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
}

export interface Asset {
  id: string;
  unit_id: string;
  name: string;
  category?: string | null;
  quantity: number;
  condition: string;
  supplier?: string | null;
  purchased_at?: string | null;
  last_repaired_at?: string | null;
  purchase_value?: number | null;
  notes?: string | null;
  unit_code?: string | null;
}

export interface Expense {
  id: string;
  property_id: string;
  category: string;
  amount: number;
  expense_date: string;
  description?: string | null;
  status?: "unpaid" | "paid" | "collecting";
  paid_at?: string | null;
  image_url?: string | null;
  due_cycle?: "monthly" | "quarterly" | "yearly";
  recurring?: boolean;
  due_date?: string | null;
  next_due_date?: string | null;
  created_at?: string;
}

export interface ExpenseJournal {
  id: string;
  expense_id: string;
  amount: number;
  due_date?: string | null;
  paid_at: string;
  image_url?: string | null;
  category: string;
  description?: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  status: string;
  paid_at: string;
  tenant_name?: string | null;
  invoice_no?: string | null;
}

export interface ExpenseMonthStatus {
  year: number;
  month: number;
  total: number;
  unpaid: number;
  paid: boolean;
  label: string;
}

export interface FeedbackImage {
  id: string;
  url: string;
  sort_order: number;
}

export interface Feedback {
  id: string;
  user_id: string;
  title: string;
  content: string;
  status: "new" | "done";
  created_at: string;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: UserRole | null;
  images: FeedbackImage[];
}
