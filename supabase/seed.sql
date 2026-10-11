-- ====================================================================
-- JANAMITRA: INITIAL SEED DATA
-- SUPABASE POSTGRESQL MIGRATION 003
-- ====================================================================

-- 1. Insert Standard Municipal Corporation Departments
INSERT INTO public.departments (id, name, code, description, contact_email, contact_phone, head_officer_name, sla_hours)
VALUES 
    ('d1111111-1111-1111-1111-111111111111', 'Solid Waste Management', 'SWM', 'Garbage collection, illegal dumping, street sweeping, and composting facilities', 'swm@municipal.gov.in', '080-22221101', 'Er. Ramesh Kulkarni', 24),
    ('d2222222-2222-2222-2222-222222222222', 'Roads & Infrastructure (PWD)', 'PWD', 'Potholes, asphalt repair, road cave-ins, footpaths, and divider maintenance', 'pwd@municipal.gov.in', '080-22221102', 'Er. Priya Sundaram', 48),
    ('d3333333-3333-3333-3333-333333333333', 'Water Supply & Sewerage Board', 'BWSSB', 'Main pipeline leaks, contaminated water supply, low water pressure, and meter issues', 'water@municipal.gov.in', '080-22221103', 'Er. Anil Deshmukh', 36),
    ('d4444444-4444-4444-4444-444444444444', 'Stormwater & Drainage', 'SWD', 'Clogged storm drains, overflowing manholes, monsoon flooding, and desilting', 'drainage@municipal.gov.in', '080-22221104', 'Er. Mohammed Tariq', 24),
    ('d5555555-5555-5555-5555-555555555555', 'Electrical & Street Lighting', 'ELEC', 'Defective streetlights, dangling live wires, non-functioning timer switches, dark spots', 'streetlights@municipal.gov.in', '080-22221105', 'Er. Sunita Rao', 24),
    ('d6666666-6666-6666-6666-666666666666', 'Public Health & Sanitation', 'PHS', 'Public toilet maintenance, mosquito fogging, vector control, dead animal removal', 'health@municipal.gov.in', '080-22221106', 'Dr. Arvind Mehra', 18),
    ('d7777777-7777-7777-7777-777777777777', 'Horticulture & Parks', 'HORT', 'Fallen tree branches, park maintenance, overgrown foliage blocking signals', 'parks@municipal.gov.in', '080-22221107', 'Venkatesh Babu', 48)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sla_hours = EXCLUDED.sla_hours;

-- 2. Insert Sample Seed Complaints
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

-- 3. Insert Status History for Seed Complaints
INSERT INTO public.complaint_status_history (complaint_id, status, notes, updated_by_name, created_at)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'submitted', 'Grievance registered through Janamitra Portal', 'System Auto-Log', NOW() - INTERVAL '3 days'),
    ('c1111111-1111-1111-1111-111111111111', 'under_review', 'Reviewed by Central Grievance Cell. Priority set to Urgent due to safety risk.', 'Duty Officer Verma', NOW() - INTERVAL '2 days'),
    ('c1111111-1111-1111-1111-111111111111', 'assigned', 'Assigned to Roads & Infrastructure (PWD) - Ward 84 Maintenance Gang', 'Chief Engineer Office', NOW() - INTERVAL '36 hours'),
    ('c1111111-1111-1111-1111-111111111111', 'in_progress', 'Road patch work team dispatched with cold-mix asphalt equipment', 'Er. Priya Sundaram', NOW() - INTERVAL '4 hours'),
    
    ('c4444444-4444-4444-4444-444444444444', 'submitted', 'Complaint logged with location coordinates', 'Citizen Deepa K.', NOW() - INTERVAL '5 days'),
    ('c4444444-4444-4444-4444-444444444444', 'assigned', 'Assigned to Electrical Subdivision Jayanagar', 'System Router', NOW() - INTERVAL '4 days'),
    ('c4444444-4444-4444-4444-444444444444', 'in_progress', 'Technician replaced faulty 70W drivers and burnt choke units', 'Lineman Ramesh M.', NOW() - INTERVAL '2 days'),
    ('c4444444-4444-4444-4444-444444444444', 'resolved', 'All 5 streetlight poles illuminated. Verified with photometer reading.', 'Er. Sunita Rao', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;
