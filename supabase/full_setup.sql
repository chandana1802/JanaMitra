-- ====================================================================
-- JANAMITRA: MUNICIPAL CORPORATION COMPLAINT MANAGEMENT SYSTEM
-- COMPLETE SUPABASE ALL-IN-ONE SETUP SCRIPT (PostgreSQL 15+)
-- Project URL: https://ldtkpmarnsoztowjrhxo.supabase.co
-- ====================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 2. CREATE TABLES
-- ====================================================================

-- 2.1 Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    head_officer_name TEXT,
    sla_hours INTEGER DEFAULT 48,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.2 Profiles Table (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'officer', 'admin')),
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ward_no TEXT,
    designation TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.3 Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN (
            'garbage', 
            'potholes', 
            'road_damage', 
            'drainage', 
            'water_leakage', 
            'streetlights', 
            'public_sanitation', 
            'other'
        )
    ),
    description TEXT NOT NULL,
    citizen_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    citizen_name TEXT,
    citizen_phone TEXT,
    citizen_email TEXT,
    address TEXT NOT NULL,
    landmark TEXT,
    ward_no TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    priority_score NUMERIC DEFAULT 50.0,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (
        status IN (
            'submitted', 
            'under_review', 
            'assigned', 
            'in_progress', 
            'resolved', 
            'rejected', 
            'reopened'
        )
    ),
    assigned_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    assigned_officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    reopen_reason TEXT,
    reopened_at TIMESTAMPTZ,
    expected_sla_date TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.4 Complaint Status History Table
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (
        status IN (
            'submitted', 
            'under_review', 
            'assigned', 
            'in_progress', 
            'resolved', 
            'rejected', 
            'reopened'
        )
    ),
    notes TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.5 Complaint Assignments Table
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assignment_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    assignment_status TEXT NOT NULL DEFAULT 'active' CHECK (assignment_status IN ('active', 'reassigned', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.6 Complaint Evidence Table (Photographs)
CREATE TABLE IF NOT EXISTS public.complaint_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT,
    evidence_type TEXT NOT NULL CHECK (
        evidence_type IN (
            'citizen_submission', 
            'officer_resolution', 
            'reopen_proof'
        )
    ),
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_complaints_reference_no ON public.complaints(reference_no);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_dept ON public.complaints(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_status_history_complaint_id ON public.complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_evidence_complaint_id ON public.complaint_evidence(complaint_id);

-- ====================================================================
-- 4. TRIGGERS & AUTO-UPDATES
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_complaints_updated_at ON public.complaints;
CREATE TRIGGER trigger_complaints_updated_at
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-sync Supabase Auth users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'citizen'),
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ensure trigger never blocks user creation in auth.users
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_evidence ENABLE ROW LEVEL SECURITY;

-- Helper to check officer or admin role
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

-- Departments Policies
DROP POLICY IF EXISTS "Departments are readable by all" ON public.departments;
CREATE POLICY "Departments are readable by all"
    ON public.departments FOR SELECT
    USING (true);

-- Profiles Policies
DROP POLICY IF EXISTS "Users can read profiles" ON public.profiles;
CREATE POLICY "Users can read profiles"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Complaints Policies
DROP POLICY IF EXISTS "Public can track and read complaints" ON public.complaints;
CREATE POLICY "Public can track and read complaints"
    ON public.complaints FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can submit complaints" ON public.complaints;
CREATE POLICY "Anyone can submit complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Officers can update complaints" ON public.complaints;
CREATE POLICY "Officers can update complaints"
    ON public.complaints FOR UPDATE
    USING (true);

-- Status History Policies
DROP POLICY IF EXISTS "Public can view status history" ON public.complaint_status_history;
CREATE POLICY "Public can view status history"
    ON public.complaint_status_history FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can insert status history" ON public.complaint_status_history;
CREATE POLICY "Anyone can insert status history"
    ON public.complaint_status_history FOR INSERT
    WITH CHECK (true);

-- Evidence Policies
DROP POLICY IF EXISTS "Evidence photos viewable by public" ON public.complaint_evidence;
CREATE POLICY "Evidence photos viewable by public"
    ON public.complaint_evidence FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can add evidence" ON public.complaint_evidence;
CREATE POLICY "Anyone can add evidence"
    ON public.complaint_evidence FOR INSERT
    WITH CHECK (true);

-- ====================================================================
-- 6. STORAGE BUCKET CONFIGURATION FOR 'complaint-evidence'
-- ====================================================================
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

DROP POLICY IF EXISTS "Public can view complaint evidence images" ON storage.objects;
CREATE POLICY "Public can view complaint evidence images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'complaint-evidence');

DROP POLICY IF EXISTS "Anyone can upload complaint images" ON storage.objects;
CREATE POLICY "Anyone can upload complaint images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'complaint-evidence');

-- ====================================================================
-- 7. SEED DATA: MUNICIPAL DEPARTMENTS & SAMPLE COMPLAINTS
-- ====================================================================
INSERT INTO public.departments (id, name, code, description, contact_email, contact_phone, head_officer_name, sla_hours)
VALUES 
    ('d1111111-1111-1111-1111-111111111111', 'Solid Waste Management', 'SWM', 'Garbage collection, illegal dumping, street sweeping', 'swm@municipal.gov.in', '080-22221101', 'Er. Ramesh Kulkarni', 24),
    ('d2222222-2222-2222-2222-222222222222', 'Roads & Infrastructure (PWD)', 'PWD', 'Potholes, asphalt repair, road cave-ins, footpaths', 'pwd@municipal.gov.in', '080-22221102', 'Er. Priya Sundaram', 48),
    ('d3333333-3333-3333-3333-333333333333', 'Water Supply & Sewerage Board', 'BWSSB', 'Main pipeline leaks, contaminated water supply', 'water@municipal.gov.in', '080-22221103', 'Er. Anil Deshmukh', 36),
    ('d4444444-4444-4444-4444-444444444444', 'Stormwater & Drainage', 'SWD', 'Clogged storm drains, overflowing manholes', 'drainage@municipal.gov.in', '080-22221104', 'Er. Mohammed Tariq', 24),
    ('d5555555-5555-5555-5555-555555555555', 'Electrical & Street Lighting', 'ELEC', 'Defective streetlights, dangling live wires', 'streetlights@municipal.gov.in', '080-22221105', 'Er. Sunita Rao', 24),
    ('d6666666-6666-6666-6666-666666666666', 'Public Health & Sanitation', 'PHS', 'Public toilet maintenance, fogging, vector control', 'health@municipal.gov.in', '080-22221106', 'Dr. Arvind Mehra', 18)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sla_hours = EXCLUDED.sla_hours;

INSERT INTO public.complaints (
    id, reference_no, category, description, citizen_name, citizen_phone, citizen_email,
    address, landmark, ward_no, latitude, longitude, priority, priority_score, status,
    assigned_department_id, created_at, updated_at
)
VALUES
    (
        'c1111111-1111-1111-1111-111111111111',
        'JNM-2026-7842',
        'potholes',
        'Severe deep potholes causing vehicle accidents near junction. Two two-wheelers skidded yesterday during drizzle.',
        'Rajesh Sharma',
        '+91 98765 43210',
        'rajesh.s@example.com',
        '14th Main, 4th Cross, Indiranagar',
        'Opposite State Bank ATM',
        'Ward 84',
        12.9784,
        77.6408,
        'urgent',
        92.0,
        'in_progress',
        'd2222222-2222-2222-2222-222222222222',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '4 hours'
    ),
    (
        'c2222222-2222-2222-2222-222222222222',
        'JNM-2026-5129',
        'garbage',
        'Massive pile of unsegregated wet and plastic waste dumped on open corner plot. Stray animals scattering waste onto road.',
        'Ananya Iyer',
        '+91 98451 22334',
        'ananya.i@example.com',
        'Corner of 7th Avenue and 3rd Main, Koramangala',
        'Near Ganesh Temple',
        'Ward 151',
        12.9352,
        77.6245,
        'high',
        78.0,
        'assigned',
        'd1111111-1111-1111-1111-111111111111',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '6 hours'
    ),
    (
        'c3333333-3333-3333-3333-333333333333',
        'JNM-2026-9041',
        'water_leakage',
        'Underground potable water main line ruptured. High pressure drinking water continuously flowing onto road for past 36 hours.',
        'Suresh Nambiar',
        '+91 99001 55667',
        'suresh.n@example.com',
        'Ring Road Service Lane, BTM 2nd Stage',
        'Near Water Tanker Depot',
        'Ward 176',
        12.9166,
        77.6101,
        'urgent',
        95.0,
        'submitted',
        'd3333333-3333-3333-3333-333333333333',
        NOW() - INTERVAL '12 hours',
        NOW() - INTERVAL '12 hours'
    ),
    (
        'c4444444-4444-4444-4444-444444444444',
        'JNM-2026-3482',
        'streetlights',
        'A sequence of 5 LED streetlights along the park perimeter road are completely non-functional. Entire stretch pitch dark at night.',
        'Deepa Kulkarni',
        '+91 97412 88990',
        'deepa.k@example.com',
        'Lake View Road, Jayanagar 4th Block',
        'Behind Madhavan Park',
        'Ward 169',
        12.9308,
        77.5838,
        'medium',
        58.0,
        'resolved',
        'd5555555-5555-5555-5555-555555555555',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '1 day'
    )
ON CONFLICT (reference_no) DO NOTHING;

INSERT INTO public.complaint_status_history (complaint_id, status, notes, updated_by_name, created_at)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'submitted', 'Grievance registered through Janamitra Portal', 'System Auto-Log', NOW() - INTERVAL '3 days'),
    ('c1111111-1111-1111-1111-111111111111', 'under_review', 'Reviewed by Central Grievance Cell. Priority set to Urgent due to safety risk.', 'Duty Officer Verma', NOW() - INTERVAL '2 days'),
    ('c1111111-1111-1111-1111-111111111111', 'assigned', 'Assigned to Roads & Infrastructure (PWD)', 'Chief Engineer Office', NOW() - INTERVAL '36 hours'),
    ('c1111111-1111-1111-1111-111111111111', 'in_progress', 'Road patch team dispatched with asphalt equipment', 'Er. Priya Sundaram', NOW() - INTERVAL '4 hours')
ON CONFLICT DO NOTHING;
