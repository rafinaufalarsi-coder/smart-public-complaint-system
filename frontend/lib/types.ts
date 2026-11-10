export type UserRole = "citizen" | "admin" | "officer";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  agency_id?: string | null;
  agency_name?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface ComplaintCategory {
  id: string;
  name: string;
  description?: string | null;
  default_agency_id?: string | null;
  is_active: boolean;
}

export interface Agency {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface ComplaintItem {
  id: string;
  ticket_no: string;
  title: string;
  description: string;
  address_text?: string | null;
  latitude: number;
  longitude: number;
  priority: "low" | "medium" | "high" | "urgent";
  visibility: "public" | "private" | "anonymous";
  current_status: string;
  category_id?: string | null;
  category_name?: string | null;
  assigned_agency_id?: string | null;
  agency_name?: string | null;
  assigned_officer_id?: string | null;
  officer_name?: string | null;
  reporter_id?: string | null;
  reporter_name?: string | null;
  submitted_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface ComplaintAttachment {
  id: string;
  object_key: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  evidence_type: string;
  created_at: string;
}

export interface TicketHistoryItem {
  id: string;
  status: string;
  note?: string | null;
  progress_percent?: number | null;
  changed_by?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  created_at: string;
}

export interface ComplaintDetail {
  id: string;
  ticket_no: string;
  title: string;
  description: string;
  address_text?: string | null;
  latitude: number;
  longitude: number;
  priority: "low" | "medium" | "high" | "urgent";
  visibility: "public" | "private" | "anonymous";
  current_status: string;
  category_id?: string | null;
  category_name?: string | null;
  assigned_agency_id?: string | null;
  agency_name?: string | null;
  assigned_officer_id?: string | null;
  officer_name?: string | null;
  reporter_id?: string | null;
  reporter_name?: string | null;
  submitted_at: string;
  updated_at: string;
  resolved_at?: string | null;
  attachments: ComplaintAttachment[];
  history: TicketHistoryItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
  details?: Record<string, unknown>;
}

