# Janamitra — Supabase Backend Integration Guide

This guide explains how to set up and connect your Supabase project with **Janamitra — Municipal Corporation Complaint Management System**.

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and log in or create a free account.
2. Click **"New Project"**.
3. Set the **Project Name**: `Janamitra`.
4. Choose a strong Database Password and select your nearest geographic region (e.g. `ap-south-1` for India / Mumbai, or closest to your users).
5. Click **"Create new project"** and wait ~1-2 minutes for provisioning to complete.

---

## Step 2: Run the SQL Migrations

Open the **SQL Editor** tab in your Supabase Dashboard:

1. Click **"New Query"**.
2. Copy the contents of [`supabase/schema.sql`](./schema.sql) and click **"Run"** (Ctrl+Enter / Cmd+Enter).
   - This creates tables: `departments`, `profiles`, `complaints`, `complaint_status_history`, `complaint_assignments`, `complaint_evidence`, plus triggers, views, and indexes.
3. Open a second query, copy the contents of [`supabase/rls_policies.sql`](./rls_policies.sql), and click **"Run"**.
   - This establishes strict Row Level Security (RLS) policies for citizens, officers, and admins.
4. (Optional) Copy and run [`supabase/seed.sql`](./seed.sql) to populate 7 municipal departments and sample grievances for immediate testing.

---

## Step 3: Configure Storage for Complaint Photographs

1. In the Supabase Dashboard, click on the **Storage** tab on the left sidebar.
2. If the bucket `complaint-evidence` wasn't created by the script:
   - Click **"New Bucket"**.
   - Name: `complaint-evidence`.
   - Toggle **"Public bucket"** to **ON** (allows citizen and officer image display).
   - Set maximum file size: `10 MB`.
   - Allowed MIME types: `image/jpeg, image/png, image/webp`.
   - Click **Save**.

---

## Step 4: Obtain Your API Credentials

1. In your Supabase Dashboard, click the **Settings (gear icon)** at the bottom left -> **API** (or **Data API**).
2. Copy the following two values:
   - **Project URL** (format: `https://xxxxxxxxxxxxxxxx.supabase.co`)
   - **Project API Keys** -> `anon` / `public` key (Publishable API Key).

> ⚠️ **Important Security Rule**: NEVER use the `service_role` (secret) key in the frontend! Only the public `anon` key is needed.

---

## Step 5: Connect Janamitra

You can connect Janamitra in either of two easy ways:

### Option A: In-App Connection Wizard (Instant)
1. Open the Janamitra application in your browser.
2. Click the **"Supabase Connection"** badge or button in the top navigation bar.
3. Paste your **Project URL** and **Anon Key**.
4. Click **"Test & Connect"**. The badge turns emerald green `Connected`!

### Option B: Environment Variables
Add these to your `.env` or project settings:
```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-publishable-key-here"
```
Restart the dev server and Janamitra connects automatically!
