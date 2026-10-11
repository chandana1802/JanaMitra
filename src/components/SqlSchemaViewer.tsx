import React, { useState } from 'react';
import {
  Database,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Layers,
  Terminal,
  FileCode,
  Sparkles,
} from 'lucide-react';

export const SqlSchemaViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'full' | 'schema' | 'rls' | 'seed'>('full');
  const [copied, setCopied] = useState(false);

  const fullSql = `-- ====================================================================
-- JANAMITRA: MUNICIPAL CORPORATION COMPLAINT MANAGEMENT SYSTEM
-- COMPLETE SUPABASE ALL-IN-ONE SETUP SCRIPT (PostgreSQL 15+)
-- Project: https://ldtkpmarnsoztowjrhxo.supabase.co
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Departments Table
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

-- 2. Profiles Table (Linked with Supabase auth.users)
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

-- 3. Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_no TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (
        category IN ('garbage', 'potholes', 'road_damage', 'drainage', 'water_leakage', 'streetlights', 'public_sanitation', 'other')
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
        status IN ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected', 'reopened')
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

-- 4. Status History Table
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Evidence Table (Photographs)
CREATE TABLE IF NOT EXISTS public.complaint_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('citizen_submission', 'officer_resolution', 'reopen_proof')),
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_complaints_reference_no ON public.complaints(reference_no);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_dept ON public.complaints(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints(latitude, longitude);

-- 7. Auto-Sync Profiles from Auth Signup
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

-- 8. Row Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read departments" ON public.departments;
CREATE POLICY "Public read departments" ON public.departments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public read complaints" ON public.complaints;
CREATE POLICY "Public read complaints" ON public.complaints FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert complaints" ON public.complaints;
CREATE POLICY "Anyone can insert complaints" ON public.complaints FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update complaints" ON public.complaints;
CREATE POLICY "Anyone can update complaints" ON public.complaints FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public read status history" ON public.complaint_status_history;
CREATE POLICY "Public read status history" ON public.complaint_status_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert status history" ON public.complaint_status_history;
CREATE POLICY "Anyone can insert status history" ON public.complaint_status_history FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public read evidence" ON public.complaint_evidence;
CREATE POLICY "Public read evidence" ON public.complaint_evidence FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert evidence" ON public.complaint_evidence;
CREATE POLICY "Anyone can insert evidence" ON public.complaint_evidence FOR INSERT WITH CHECK (true);

-- 9. Storage Bucket 'complaint-evidence'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('complaint-evidence', 'complaint-evidence', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public view complaint photos" ON storage.objects;
CREATE POLICY "Public view complaint photos" ON storage.objects FOR SELECT USING (bucket_id = 'complaint-evidence');

DROP POLICY IF EXISTS "Public upload complaint photos" ON storage.objects;
CREATE POLICY "Public upload complaint photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'complaint-evidence');

-- 10. Seed Municipal Departments
INSERT INTO public.departments (id, name, code, description, contact_email, contact_phone, sla_hours)
VALUES 
    ('d1111111-1111-1111-1111-111111111111', 'Solid Waste Management', 'SWM', 'Garbage collection, illegal dumping, street sweeping', 'swm@municipal.gov.in', '080-22221101', 24),
    ('d2222222-2222-2222-2222-222222222222', 'Roads & Infrastructure (PWD)', 'PWD', 'Potholes, asphalt repair, road cave-ins, footpaths', 'pwd@municipal.gov.in', '080-22221102', 48),
    ('d3333333-3333-3333-3333-333333333333', 'Water Supply & Sewerage Board', 'BWSSB', 'Main pipeline leaks, contaminated water supply', 'water@municipal.gov.in', '080-22221103', 36),
    ('d4444444-4444-4444-4444-444444444444', 'Stormwater & Drainage', 'SWD', 'Clogged storm drains, overflowing manholes', 'drainage@municipal.gov.in', '080-22221104', 24),
    ('d5555555-5555-5555-5555-555555555555', 'Electrical & Street Lighting', 'ELEC', 'Defective streetlights, dangling live wires', 'streetlights@municipal.gov.in', '080-22221105', 24),
    ('d6666666-6666-6666-6666-666666666666', 'Public Health & Sanitation', 'PHS', 'Public toilet maintenance, fogging, vector control', 'health@municipal.gov.in', '080-22221106', 18)
ON CONFLICT (code) DO NOTHING;`;

  const sqlSnippets = {
    full: fullSql,
    schema: `-- View /supabase/schema.sql in the codebase`,
    rls: `-- View /supabase/rls_policies.sql in the codebase`,
    seed: `-- View /supabase/seed.sql in the codebase`,
  };

  const handleCopyCurrent = () => {
    navigator.clipboard.writeText(fullSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-2">
            <Terminal className="w-3.5 h-3.5" />
            <span>PostgreSQL Backend Migrations</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Database Schema & SQL Migrations
          </h1>
          <p className="mt-1 text-slate-600 text-sm">
            Execute this SQL script in your Supabase SQL Editor to provision tables, security rules, and storage.
          </p>
        </div>

        <a
          href="https://supabase.com/dashboard/project/ldtkpmarnsoztowjrhxo/sql/new"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
        >
          <span>Open SQL Editor in Supabase</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Connection Info Box */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-slate-900 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Configured Supabase Project URL:</span>
          </div>
          <code className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono text-[11px] font-bold">
            https://ldtkpmarnsoztowjrhxo.supabase.co
          </code>
        </div>
        <button
          onClick={handleCopyCurrent}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition flex items-center space-x-1.5 shadow-xs whitespace-nowrap"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Copied All SQL!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Full Setup SQL</span>
            </>
          )}
        </button>
      </div>

      {/* Code Container */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl text-slate-200">
        <div className="flex flex-wrap items-center justify-between p-4 bg-slate-950 border-b border-slate-800 gap-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>All-In-One SQL Migration Script (Tables + RLS + Storage + Seed)</span>
          </div>

          <button
            onClick={handleCopyCurrent}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center space-x-1.5 border border-slate-700 shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy SQL</span>
              </>
            )}
          </button>
        </div>

        {/* Code Body */}
        <div className="p-6 overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs text-emerald-300 leading-relaxed bg-slate-900">
          <pre>{fullSql}</pre>
        </div>
      </div>
    </div>
  );
};
