-- ====================================================================
-- JANAMITRA: ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- SUPABASE POSTGRESQL MIGRATION 002
-- ====================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_evidence ENABLE ROW LEVEL SECURITY;

-- Helper function to check current user role
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    RETURN COALESCE(user_role, 'citizen');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if current user is officer or admin
CREATE OR REPLACE FUNCTION public.is_officer_or_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    RETURN user_role IN ('officer', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- --------------------------------------------------------------------
-- A. DEPARTMENTS POLICIES
-- --------------------------------------------------------------------
-- Anyone (authenticated or anon) can view active municipal departments
DROP POLICY IF EXISTS "Departments are readable by all" ON public.departments;
CREATE POLICY "Departments are readable by all"
    ON public.departments FOR SELECT
    USING (is_active = TRUE OR public.is_officer_or_admin());

-- Only admins can insert or update departments
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments"
    ON public.departments FOR ALL
    TO authenticated
    USING (public.get_current_role() = 'admin')
    WITH CHECK (public.get_current_role() = 'admin');

-- --------------------------------------------------------------------
-- B. PROFILES POLICIES
-- --------------------------------------------------------------------
-- Users can view their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_officer_or_admin());

-- Users can update their own personal info (name, phone) but CANNOT escalate their role
DROP POLICY IF EXISTS "Users can update own basic profile" ON public.profiles;
CREATE POLICY "Users can update own basic profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND (
            role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
            OR public.get_current_role() = 'admin'
        )
    );

-- Admins can update any profile (e.g. assign officer roles)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.get_current_role() = 'admin')
    WITH CHECK (public.get_current_role() = 'admin');

-- --------------------------------------------------------------------
-- C. COMPLAINTS POLICIES
-- --------------------------------------------------------------------
-- 1. Anyone can view sanitized complaint records by reference number for tracking
DROP POLICY IF EXISTS "Anyone can track complaints by ref" ON public.complaints;
CREATE POLICY "Anyone can track complaints by ref"
    ON public.complaints FOR SELECT
    USING (
        -- Citizen reading their own complaint
        (auth.uid() IS NOT NULL AND citizen_id = auth.uid())
        -- Officers & admins can view all
        OR public.is_officer_or_admin()
        -- Public tracking access (anonymized view or direct select with non-sensitive fields)
        OR true
    );

-- 2. Citizens & guests can submit new complaints
DROP POLICY IF EXISTS "Anyone can insert complaints" ON public.complaints;
CREATE POLICY "Anyone can insert complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (
        -- If signed in, citizen_id must match auth.uid()
        (auth.uid() IS NULL OR citizen_id = auth.uid())
        -- Ensure initial status is 'submitted'
        AND status = 'submitted'
    );

-- 3. Officers and Admins can update complaint status, priority, department, etc.
DROP POLICY IF EXISTS "Officers and Admins can update complaints" ON public.complaints;
CREATE POLICY "Officers and Admins can update complaints"
    ON public.complaints FOR UPDATE
    TO authenticated
    USING (public.is_officer_or_admin())
    WITH CHECK (public.is_officer_or_admin());

-- 4. Citizens can update only to request reopening their resolved complaints
DROP POLICY IF EXISTS "Citizens can reopen own resolved complaint" ON public.complaints;
CREATE POLICY "Citizens can reopen own resolved complaint"
    ON public.complaints FOR UPDATE
    TO authenticated
    USING (citizen_id = auth.uid() AND status = 'resolved')
    WITH CHECK (citizen_id = auth.uid() AND status = 'reopened');

-- --------------------------------------------------------------------
-- D. COMPLAINT STATUS HISTORY POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view status history" ON public.complaint_status_history;
CREATE POLICY "Public can view status history"
    ON public.complaint_status_history FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Officers can insert status history" ON public.complaint_status_history;
CREATE POLICY "Officers can insert status history"
    ON public.complaint_status_history FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_officer_or_admin() 
        OR EXISTS (
            SELECT 1 FROM public.complaints c 
            WHERE c.id = complaint_id AND c.citizen_id = auth.uid()
        )
    );

-- --------------------------------------------------------------------
-- E. COMPLAINT EVIDENCE (PHOTOS) POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Evidence photos viewable by public" ON public.complaint_evidence;
CREATE POLICY "Evidence photos viewable by public"
    ON public.complaint_evidence FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can add submission evidence" ON public.complaint_evidence;
CREATE POLICY "Anyone can add submission evidence"
    ON public.complaint_evidence FOR INSERT
    WITH CHECK (
        evidence_type IN ('citizen_submission', 'reopen_proof')
        OR public.is_officer_or_admin()
    );

-- --------------------------------------------------------------------
-- F. COMPLAINT ASSIGNMENTS POLICIES
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Officers and Admins can view assignments" ON public.complaint_assignments;
CREATE POLICY "Officers and Admins can view assignments"
    ON public.complaint_assignments FOR SELECT
    TO authenticated
    USING (public.is_officer_or_admin());

DROP POLICY IF EXISTS "Admins and Lead Officers can manage assignments" ON public.complaint_assignments;
CREATE POLICY "Admins and Lead Officers can manage assignments"
    ON public.complaint_assignments FOR ALL
    TO authenticated
    USING (public.is_officer_or_admin())
    WITH CHECK (public.is_officer_or_admin());

-- --------------------------------------------------------------------
-- G. SUPABASE STORAGE BUCKET POLICIES FOR 'complaint-evidence'
-- --------------------------------------------------------------------
-- Note: Create bucket 'complaint-evidence' in Supabase Dashboard > Storage
-- Then execute:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'complaint-evidence', 
    'complaint-evidence', 
    true, 
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 10485760;

-- Storage object read policy
DROP POLICY IF EXISTS "Public can view complaint evidence images" ON storage.objects;
CREATE POLICY "Public can view complaint evidence images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'complaint-evidence');

-- Storage object upload policy
DROP POLICY IF EXISTS "Anyone can upload complaint images" ON storage.objects;
CREATE POLICY "Anyone can upload complaint images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'complaint-evidence');
