import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  AuthUser,
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  Department,
  Profile,
  UserRole,
} from '../types';
import { INITIAL_DEPARTMENTS } from './constants';
import { INITIAL_COMPLAINTS } from './mockData';
import { calculatePriorityScore } from './priorityScorer';

const STORAGE_KEY_URL = 'janamitra_supabase_url';
const STORAGE_KEY_KEY = 'janamitra_supabase_anon_key';
const STORAGE_KEY_LOCAL_COMPLAINTS = 'janamitra_local_complaints';
const STORAGE_KEY_ACTIVE_USER = 'janamitra_active_user';

export const DEFAULT_SUPABASE_URL = 'https://ldtkpmarnsoztowjrhxo.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_ebteUDyk29u5tNMadNNClA_PTgkHeCY';

export function getStoredSupabaseConfig() {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const localUrl = (localStorage.getItem(STORAGE_KEY_URL) || '').trim();
  const localKey = (localStorage.getItem(STORAGE_KEY_KEY) || '').trim();

  const url = localUrl || envUrl || DEFAULT_SUPABASE_URL;
  const key = localKey || envKey || DEFAULT_SUPABASE_ANON_KEY;

  return {
    url,
    key,
    isConfigured: Boolean(url && key && url.includes('supabase.co')),
    source: localUrl ? 'custom' : envUrl ? 'env' : 'configured',
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  if (url && key) {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
    localStorage.setItem(STORAGE_KEY_KEY, key.trim());
    // Re-initialize client
    initSupabaseClient();
  }
}

export function clearSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  supabaseClient = null;
}

let supabaseClient: SupabaseClient | null = null;

export function initSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getStoredSupabaseConfig();
  if (isConfigured && url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return supabaseClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  }
  return null;
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseClient) {
    initSupabaseClient();
  }
  return supabaseClient;
}

// Check real Supabase connectivity
export async function testSupabaseConnection(customUrl?: string, customKey?: string): Promise<{
  success: boolean;
  message: string;
  tablesFound?: boolean;
}> {
  const url = customUrl || getStoredSupabaseConfig().url;
  const key = customKey || getStoredSupabaseConfig().key;

  if (!url || !key) {
    return {
      success: false,
      message: 'Supabase Project URL and Publishable Anon Key are missing.',
    };
  }

  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    return {
      success: false,
      message: 'Project URL format looks invalid. Expected: https://your-project-id.supabase.co',
    };
  }

  try {
    const testClient = createClient(url, key);
    // Attempt a light ping on departments
    const { data, error } = await testClient.from('departments').select('id, name').limit(1);

    if (error) {
      // 404 or table not found means connection works but schema migration is pending
      if (error.code === '42P01' || error.message.includes('relation "public.departments" does not exist')) {
        return {
          success: true,
          tablesFound: false,
          message: 'Connected to Supabase project! Note: Tables not found yet. Please run schema.sql in SQL Editor.',
        };
      }
      return {
        success: false,
        message: `Supabase returned error: ${error.message} (Code: ${error.code})`,
      };
    }

    return {
      success: true,
      tablesFound: true,
      message: `Successfully connected to Supabase! Found ${data ? data.length : 0} department records.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error while connecting to Supabase.',
    };
  }
}

// -------------------------------------------------------------------------
// REPOSITORY LAYER (Dual: Supabase PostgreSQL with reactive local storage fallback)
// -------------------------------------------------------------------------

function getLocalComplaints(): Complaint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_COMPLAINTS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error parsing local complaints', e);
  }
  localStorage.setItem(STORAGE_KEY_LOCAL_COMPLAINTS, JSON.stringify(INITIAL_COMPLAINTS));
  return INITIAL_COMPLAINTS;
}

function saveLocalComplaints(complaints: Complaint[]) {
  localStorage.setItem(STORAGE_KEY_LOCAL_COMPLAINTS, JSON.stringify(complaints));
}

export const dbService = {
  // 1. Fetch departments
  async getDepartments(): Promise<Department[]> {
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client
          .from('departments')
          .select('*')
          .order('name');
        if (!error && data && data.length > 0) {
          return data as Department[];
        }
      } catch (err) {
        console.warn('Falling back to local departments:', err);
      }
    }
    return INITIAL_DEPARTMENTS;
  },

  // 2. Fetch all complaints (for dashboard)
  async getComplaints(): Promise<Complaint[]> {
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client
          .from('complaints')
          .select(`
            *,
            department:departments(*),
            evidence:complaint_evidence(*),
            history:complaint_status_history(*)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as Complaint[];
        }
      } catch (err) {
        console.warn('Falling back to local complaints:', err);
      }
    }
    return getLocalComplaints();
  },

  // 3. Fetch single complaint by Reference Number (safe for public tracking)
  async getComplaintByReferenceNo(refNo: string): Promise<Complaint | null> {
    const cleanRef = refNo.trim().toUpperCase();
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client
          .from('complaints')
          .select(`
            *,
            department:departments(*),
            evidence:complaint_evidence(*),
            history:complaint_status_history(*)
          `)
          .ilike('reference_no', cleanRef)
          .maybeSingle();

        if (!error && data) {
          return data as Complaint;
        }
      } catch (err) {
        console.warn('Falling back to local search:', err);
      }
    }

    const locals = getLocalComplaints();
    return locals.find((c) => c.reference_no.toUpperCase() === cleanRef) || null;
  },

  // 4. Create new complaint
  async createComplaint(payload: {
    category: ComplaintCategory;
    description: string;
    citizen_name?: string;
    citizen_phone?: string;
    citizen_email?: string;
    citizen_id?: string;
    address: string;
    landmark?: string;
    ward_no?: string;
    latitude?: number;
    longitude?: number;
    priority?: ComplaintPriority;
    evidencePhotos?: { url: string; path?: string; name?: string }[];
  }): Promise<{ complaint: Complaint; isOnline: boolean }> {
    // Generate unique reference number: JNM-2026-XXXX
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const reference_no = `JNM-2026-${randomDigits}`;

    // Calculate priority & score
    const scoreBreakdown = calculatePriorityScore(
      payload.category,
      payload.description
    );
    const finalPriority = payload.priority || scoreBreakdown.priority;

    // Automatic department routing
    const departments = await this.getDepartments();
    const categoryDeptMap: Record<ComplaintCategory, string> = {
      garbage: 'SWM',
      potholes: 'PWD',
      road_damage: 'PWD',
      water_leakage: 'BWSSB',
      drainage: 'SWD',
      streetlights: 'ELEC',
      public_sanitation: 'PHS',
      other: 'PWD',
    };
    const targetDeptCode = categoryDeptMap[payload.category];
    const targetDept = departments.find((d) => d.code === targetDeptCode) || departments[0];

    const client = getSupabase();
    let onlineComplaint: Complaint | null = null;

    if (client) {
      try {
        const newRecord = {
          reference_no,
          category: payload.category,
          description: payload.description,
          citizen_name: payload.citizen_name || 'Anonymous Citizen',
          citizen_phone: payload.citizen_phone || null,
          citizen_email: payload.citizen_email || null,
          citizen_id: payload.citizen_id || null,
          address: payload.address,
          landmark: payload.landmark || null,
          ward_no: payload.ward_no || 'Ward Central',
          latitude: payload.latitude || null,
          longitude: payload.longitude || null,
          priority: finalPriority,
          priority_score: scoreBreakdown.totalScore,
          status: 'submitted',
          assigned_department_id: targetDept ? targetDept.id : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await client
          .from('complaints')
          .insert([newRecord])
          .select('*')
          .single();

        if (!error && data) {
          // Log initial status history
          await client.from('complaint_status_history').insert([
            {
              complaint_id: data.id,
              status: 'submitted',
              notes: 'Grievance submitted via Janamitra Citizen Portal',
              updated_by_name: payload.citizen_name || 'Citizen',
            },
          ]);

          // Insert photo evidence
          if (payload.evidencePhotos && payload.evidencePhotos.length > 0) {
            const evidenceRecords = payload.evidencePhotos.map((p) => ({
              complaint_id: data.id,
              file_url: p.url,
              file_path: p.path || `complaints/${reference_no}/submission/${p.name || 'photo.jpg'}`,
              evidence_type: 'citizen_submission',
            }));
            await client.from('complaint_evidence').insert(evidenceRecords);
          }

          onlineComplaint = {
            ...data,
            department: targetDept,
            evidence: (payload.evidencePhotos || []).map((p, idx) => ({
              id: `ev-${idx}`,
              complaint_id: data.id,
              file_url: p.url,
              file_path: p.path || '',
              evidence_type: 'citizen_submission',
              created_at: new Date().toISOString(),
            })),
            history: [
              {
                id: 'h-init',
                complaint_id: data.id,
                status: 'submitted',
                notes: 'Grievance submitted via Janamitra Citizen Portal',
                updated_by_name: payload.citizen_name || 'Citizen',
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
      } catch (err) {
        console.warn('Supabase insert failed, storing locally:', err);
      }
    }

    // Always create/update local state as well
    const complaintId = onlineComplaint ? onlineComplaint.id : `c-${Date.now()}`;
    const localItem: Complaint = onlineComplaint || {
      id: complaintId,
      reference_no,
      category: payload.category,
      description: payload.description,
      citizen_name: payload.citizen_name || 'Anonymous Citizen',
      citizen_phone: payload.citizen_phone,
      citizen_email: payload.citizen_email,
      citizen_id: payload.citizen_id,
      address: payload.address,
      landmark: payload.landmark,
      ward_no: payload.ward_no || 'Ward Central',
      latitude: payload.latitude,
      longitude: payload.longitude,
      priority: finalPriority,
      priority_score: scoreBreakdown.totalScore,
      status: 'submitted',
      assigned_department_id: targetDept ? targetDept.id : undefined,
      department: targetDept,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      evidence: (payload.evidencePhotos || []).map((p, idx) => ({
        id: `ev-${Date.now()}-${idx}`,
        complaint_id: complaintId,
        file_url: p.url,
        file_path: p.path || `complaints/${reference_no}/submission/photo.jpg`,
        evidence_type: 'citizen_submission',
        created_at: new Date().toISOString(),
      })),
      history: [
        {
          id: `h-${Date.now()}`,
          complaint_id: complaintId,
          status: 'submitted',
          notes: 'Grievance submitted via Janamitra Citizen Portal',
          updated_by_name: payload.citizen_name || 'Citizen',
          created_at: new Date().toISOString(),
        },
      ],
    };

    const currentLocals = getLocalComplaints();
    saveLocalComplaints([localItem, ...currentLocals]);

    return {
      complaint: localItem,
      isOnline: Boolean(onlineComplaint),
    };
  },

  // 5. Update Status (Officer operation)
  async updateComplaintStatus(
    complaintId: string,
    newStatus: ComplaintStatus,
    notes: string,
    officerName: string,
    resolutionPhoto?: { url: string; path?: string }
  ): Promise<boolean> {
    const client = getSupabase();
    let onlineSuccess = false;

    if (client) {
      try {
        const updatePayload: any = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        if (newStatus === 'resolved') {
          updatePayload.resolved_at = new Date().toISOString();
          updatePayload.resolution_notes = notes;
        }

        const { error } = await client
          .from('complaints')
          .update(updatePayload)
          .eq('id', complaintId);

        if (!error) {
          // Add history
          await client.from('complaint_status_history').insert([
            {
              complaint_id: complaintId,
              status: newStatus,
              notes,
              updated_by_name: officerName,
            },
          ]);

          // If resolution photo provided, insert evidence
          if (resolutionPhoto && newStatus === 'resolved') {
            await client.from('complaint_evidence').insert([
              {
                complaint_id: complaintId,
                file_url: resolutionPhoto.url,
                file_path: resolutionPhoto.path || `complaints/${complaintId}/resolution/after.jpg`,
                evidence_type: 'officer_resolution',
              },
            ]);
          }
          onlineSuccess = true;
        }
      } catch (err) {
        console.warn('Failed to update status on Supabase:', err);
      }
    }

    // Update local cache
    const locals = getLocalComplaints();
    const updatedLocals = locals.map((c) => {
      if (c.id === complaintId) {
        const newHistory = [
          ...(c.history || []),
          {
            id: `h-${Date.now()}`,
            complaint_id: complaintId,
            status: newStatus,
            notes,
            updated_by_name: officerName,
            created_at: new Date().toISOString(),
          },
        ];

        const newEvidence = [...(c.evidence || [])];
        if (resolutionPhoto && newStatus === 'resolved') {
          newEvidence.push({
            id: `ev-${Date.now()}`,
            complaint_id: complaintId,
            file_url: resolutionPhoto.url,
            file_path: resolutionPhoto.path || '',
            evidence_type: 'officer_resolution',
            created_at: new Date().toISOString(),
          });
        }

        return {
          ...c,
          status: newStatus,
          resolution_notes: newStatus === 'resolved' ? notes : c.resolution_notes,
          resolved_at: newStatus === 'resolved' ? new Date().toISOString() : c.resolved_at,
          updated_at: new Date().toISOString(),
          history: newHistory,
          evidence: newEvidence,
        };
      }
      return c;
    });

    saveLocalComplaints(updatedLocals);
    return true;
  },

  // 6. Citizen Reopen Complaint
  async reopenComplaint(
    complaintId: string,
    reason: string,
    citizenName: string,
    evidencePhoto?: { url: string; path?: string }
  ): Promise<boolean> {
    const client = getSupabase();

    if (client) {
      try {
        const { error } = await client
          .from('complaints')
          .update({
            status: 'reopened',
            reopen_reason: reason,
            reopened_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', complaintId);

        if (!error) {
          await client.from('complaint_status_history').insert([
            {
              complaint_id: complaintId,
              status: 'reopened',
              notes: `Citizen requested reopening: "${reason}"`,
              updated_by_name: citizenName,
            },
          ]);

          if (evidencePhoto) {
            await client.from('complaint_evidence').insert([
              {
                complaint_id: complaintId,
                file_url: evidencePhoto.url,
                file_path: evidencePhoto.path || `complaints/${complaintId}/reopen/proof.jpg`,
                evidence_type: 'reopen_proof',
              },
            ]);
          }
        }
      } catch (err) {
        console.warn('Supabase reopen failed:', err);
      }
    }

    // Local update
    const locals = getLocalComplaints();
    const updated = locals.map((c) => {
      if (c.id === complaintId) {
        const newEvidence = [...(c.evidence || [])];
        if (evidencePhoto) {
          newEvidence.push({
            id: `ev-reopen-${Date.now()}`,
            complaint_id: complaintId,
            file_url: evidencePhoto.url,
            file_path: evidencePhoto.path || '',
            evidence_type: 'reopen_proof',
            created_at: new Date().toISOString(),
          });
        }

        return {
          ...c,
          status: 'reopened' as ComplaintStatus,
          reopen_reason: reason,
          reopened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          history: [
            ...(c.history || []),
            {
              id: `h-reopen-${Date.now()}`,
              complaint_id: complaintId,
              status: 'reopened' as ComplaintStatus,
              notes: `Citizen requested reopening: "${reason}"`,
              updated_by_name: citizenName,
              created_at: new Date().toISOString(),
            },
          ],
          evidence: newEvidence,
        };
      }
      return c;
    });

    saveLocalComplaints(updated);
    return true;
  },

  // 7. Storage Upload Helper
  async uploadFile(
    file: File,
    referenceNo: string,
    folder: 'submission' | 'resolution' | 'reopen'
  ): Promise<{ url: string; path: string }> {
    const client = getSupabase();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `complaints/${referenceNo}/${folder}/${fileName}`;

    if (client) {
      try {
        const { data, error } = await client.storage
          .from('complaint-evidence')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (!error && data) {
          const { data: publicUrlData } = client.storage
            .from('complaint-evidence')
            .getPublicUrl(filePath);

          return {
            url: publicUrlData.publicUrl,
            path: filePath,
          };
        }
      } catch (err) {
        console.warn('Storage upload error, using local object URL:', err);
      }
    }

    // Fallback: Read as base64 data URL so it persists in browser storage!
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          url: reader.result as string,
          path: filePath,
        });
      };
      reader.readAsDataURL(file);
    });
  },

  // 8. Auth Helper
  getActiveUser(): AuthUser | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return null;
  },

  setActiveUser(user: AuthUser | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
    }
  },
};

// =========================================================================
// SUPABASE AUTHENTICATION SERVICE (Real auth.users + public.profiles sync)
// =========================================================================
export const authService = {
  // Sign up with Supabase Auth -> creates real user in Supabase Authentication -> Users
  async signUp(params: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
  }): Promise<{
    user: User | null;
    session: any | null;
    profile: Profile | null;
    requiresVerification: boolean;
    error: string | null;
  }> {
    const client = getSupabase();
    if (!client) {
      return {
        user: null,
        session: null,
        profile: null,
        requiresVerification: false,
        error: 'Supabase client is not configured. Please check project URL and keys.',
      };
    }

    try {
      const role = params.role || 'citizen';
      // 1. Call supabase.auth.signUp() with raw_user_meta_data
      const { data, error } = await client.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          data: {
            full_name: params.fullName.trim(),
            phone: params.phone?.trim() || null,
            role: role,
          },
        },
      });

      if (error) {
        let errorMsg = error.message;
        if (
          error.message.includes('already registered') ||
          error.message.includes('User already registered')
        ) {
          errorMsg = 'An account with this email address already exists. Please sign in instead.';
        } else if (error.message.includes('Password should be at least')) {
          errorMsg = 'Password must be at least 6 characters long.';
        }
        return {
          user: null,
          session: null,
          profile: null,
          requiresVerification: false,
          error: errorMsg,
        };
      }

      if (!data.user) {
        return {
          user: null,
          session: null,
          profile: null,
          requiresVerification: false,
          error: 'Registration failed to return user data from Supabase.',
        };
      }

      const requiresVerification =
        !data.session &&
        Boolean(data.user.identities && data.user.identities.length > 0);

      // 2. Ensure profile row in public.profiles table
      let profileRecord: Profile | null = null;
      try {
        const { data: profData } = await client
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              full_name: params.fullName.trim(),
              phone: params.phone?.trim() || null,
              role: role,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          )
          .select('*')
          .maybeSingle();

        if (profData) {
          profileRecord = profData as Profile;
        }
      } catch (profError) {
        console.warn('Note: Profile table upsert (handled):', profError);
      }

      // If session established immediately (e.g. email confirmation disabled in project)
      if (data.session) {
        const authUser: AuthUser = {
          id: data.user.id,
          email: data.user.email || params.email,
          full_name: params.fullName,
          phone: params.phone,
          role: role,
        };
        dbService.setActiveUser(authUser);
      }

      return {
        user: data.user,
        session: data.session,
        profile: profileRecord,
        requiresVerification,
        error: null,
      };
    } catch (err: any) {
      return {
        user: null,
        session: null,
        profile: null,
        requiresVerification: false,
        error: err.message || 'An unexpected error occurred during registration.',
      };
    }
  },

  // Sign in using Supabase Auth: supabase.auth.signInWithPassword()
  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<{
    user: User | null;
    session: any | null;
    profile: Profile | null;
    authUser: AuthUser | null;
    error: string | null;
  }> {
    const client = getSupabase();
    if (!client) {
      return {
        user: null,
        session: null,
        profile: null,
        authUser: null,
        error: 'Supabase client is not initialized.',
      };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: params.email.trim(),
        password: params.password,
      });

      if (error) {
        let msg = error.message;
        if (msg.includes('Invalid login credentials')) {
          msg = 'Invalid email or password. Please verify your credentials or register a new account.';
        } else if (msg.includes('Email not confirmed')) {
          msg = 'Your email address has not been verified yet. Check your inbox or disable email confirmation in your Supabase Auth settings.';
        }
        return {
          user: null,
          session: null,
          profile: null,
          authUser: null,
          error: msg,
        };
      }

      if (!data.user) {
        return {
          user: null,
          session: null,
          profile: null,
          authUser: null,
          error: 'No user data returned from authentication.',
        };
      }

      // Retrieve profile details from public.profiles table
      let profile: Profile | null = null;
      try {
        const { data: profData } = await client
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profData) {
          profile = profData as Profile;
        } else {
          // If profile row doesn't exist yet, insert it from auth metadata
          const meta = data.user.user_metadata || {};
          const fallbackProfile = {
            id: data.user.id,
            full_name: meta.full_name || data.user.email?.split('@')[0] || 'User',
            phone: meta.phone || null,
            role: (meta.role as UserRole) || 'citizen',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const { data: createdProf } = await client
            .from('profiles')
            .upsert(fallbackProfile, { onConflict: 'id' })
            .select('*')
            .maybeSingle();
          if (createdProf) {
            profile = createdProf as Profile;
          }
        }
      } catch (e) {
        console.warn('Profile fetch note:', e);
      }

      const meta = data.user.user_metadata || {};
      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || params.email,
        full_name:
          profile?.full_name ||
          meta.full_name ||
          data.user.email?.split('@')[0] ||
          'Citizen',
        phone: profile?.phone || meta.phone || undefined,
        role: (profile?.role || meta.role || 'citizen') as UserRole,
        department_id: profile?.department_id,
        ward_no: profile?.ward_no,
      };

      dbService.setActiveUser(authUser);

      return {
        user: data.user,
        session: data.session,
        profile,
        authUser,
        error: null,
      };
    } catch (err: any) {
      return {
        user: null,
        session: null,
        profile: null,
        authUser: null,
        error: err.message || 'Login failed.',
      };
    }
  },

  // Sign out from Supabase session
  async signOut(): Promise<{ error: string | null }> {
    const client = getSupabase();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        console.warn('Sign out warning:', e);
      }
    }
    dbService.setActiveUser(null);
    return { error: null };
  },

  // Get current session and profile
  async getSession(): Promise<{ user: User | null; authUser: AuthUser | null }> {
    const client = getSupabase();
    if (!client) {
      const local = dbService.getActiveUser();
      return { user: null, authUser: local };
    }

    try {
      const { data } = await client.auth.getSession();
      if (data.session?.user) {
        const u = data.session.user;
        let profData: Profile | null = null;
        try {
          const { data: p } = await client
            .from('profiles')
            .select('*')
            .eq('id', u.id)
            .maybeSingle();
          if (p) profData = p as Profile;
        } catch (e) {}

        const meta = u.user_metadata || {};
        const authUser: AuthUser = {
          id: u.id,
          email: u.email || '',
          full_name:
            profData?.full_name ||
            meta.full_name ||
            u.email?.split('@')[0] ||
            'Citizen',
          phone: profData?.phone || meta.phone || undefined,
          role: (profData?.role || meta.role || 'citizen') as UserRole,
          department_id: profData?.department_id,
          ward_no: profData?.ward_no,
        };
        dbService.setActiveUser(authUser);
        return { user: u, authUser };
      }
    } catch (e) {
      console.warn('Error reading Supabase session:', e);
    }

    const local = dbService.getActiveUser();
    return { user: null, authUser: local };
  },

  // Subscribe to session state changes
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    const client = getSupabase();
    if (!client) {
      return { unsubscribe: () => {} };
    }

    const { data: listener } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const u = session.user;
          const meta = u.user_metadata || {};
          let profData: Profile | null = null;
          try {
            const { data: p } = await client
              .from('profiles')
              .select('*')
              .eq('id', u.id)
              .maybeSingle();
            if (p) profData = p as Profile;
          } catch (e) {}

          const authUser: AuthUser = {
            id: u.id,
            email: u.email || '',
            full_name:
              profData?.full_name ||
              meta.full_name ||
              u.email?.split('@')[0] ||
              'Citizen',
            phone: profData?.phone || meta.phone || undefined,
            role: (profData?.role || meta.role || 'citizen') as UserRole,
            department_id: profData?.department_id,
            ward_no: profData?.ward_no,
          };
          dbService.setActiveUser(authUser);
          callback(authUser);
        } else if (event === 'SIGNED_OUT') {
          dbService.setActiveUser(null);
          callback(null);
        }
      }
    );

    return {
      unsubscribe: () => {
        listener.subscription.unsubscribe();
      },
    };
  },
};

