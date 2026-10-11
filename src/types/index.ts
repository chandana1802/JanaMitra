export type ComplaintCategory =
  | 'garbage'
  | 'potholes'
  | 'road_damage'
  | 'drainage'
  | 'water_leakage'
  | 'streetlights'
  | 'public_sanitation'
  | 'other';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ComplaintStatus =
  | 'submitted'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected'
  | 'reopened';

export type UserRole = 'citizen' | 'officer' | 'admin';

export type EvidenceType = 'citizen_submission' | 'officer_resolution' | 'reopen_proof';

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  head_officer_name?: string;
  sla_hours?: number;
  is_active: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  department_id?: string;
  ward_no?: string;
  designation?: string;
  created_at?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  department_id?: string;
  ward_no?: string;
}

export interface ComplaintEvidence {
  id: string;
  complaint_id: string;
  file_url: string;
  file_path: string;
  file_name?: string;
  evidence_type: EvidenceType;
  uploaded_by?: string;
  created_at: string;
}

export interface ComplaintStatusHistory {
  id: string;
  complaint_id: string;
  status: ComplaintStatus;
  notes?: string;
  updated_by?: string;
  updated_by_name?: string;
  created_at: string;
}

export interface ComplaintAssignment {
  id: string;
  complaint_id: string;
  department_id: string;
  officer_id?: string;
  assigned_by?: string;
  assignment_date: string;
  assignment_status: 'active' | 'reassigned' | 'completed';
  notes?: string;
}

export interface Complaint {
  id: string;
  reference_no: string;
  category: ComplaintCategory;
  description: string;
  citizen_id?: string;
  citizen_name?: string;
  citizen_phone?: string;
  citizen_email?: string;
  address: string;
  landmark?: string;
  ward_no?: string;
  latitude?: number;
  longitude?: number;
  priority: ComplaintPriority;
  priority_score: number;
  status: ComplaintStatus;
  assigned_department_id?: string;
  assigned_officer_id?: string;
  resolution_notes?: string;
  reopen_reason?: string;
  reopened_at?: string;
  expected_sla_date?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  
  // Relations populated for display
  department?: Department;
  evidence?: ComplaintEvidence[];
  history?: ComplaintStatusHistory[];
}

export interface CategoryMeta {
  id: ComplaintCategory;
  label: string;
  icon: string;
  defaultDeptCode: string;
  urgencyWeight: number; // 1-10
  description: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  score: number;
  matches: Complaint[];
  warningMessage?: string;
}
