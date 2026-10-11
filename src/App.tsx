/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  FileText,
  Search,
  LayoutDashboard,
  MapPin,
  Database,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  PhoneCall,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { Complaint, Department, UserRole, AuthUser } from './types';
import {
  getStoredSupabaseConfig,
  testSupabaseConnection,
  dbService,
  authService,
} from './lib/supabase';
import { INITIAL_DEPARTMENTS } from './lib/constants';
import { Navbar } from './components/Navbar';
import { CitizenComplaintForm } from './components/CitizenComplaintForm';
import { ComplaintTracker } from './components/ComplaintTracker';
import { OfficerDashboard } from './components/OfficerDashboard';
import { AnalyticsView } from './components/AnalyticsView';
import { SqlSchemaViewer } from './components/SqlSchemaViewer';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<
    'submit' | 'track' | 'dashboard' | 'analytics' | 'sql'
  >('submit');
  const [trackRef, setTrackRef] = useState<string>('JNM-2026-7842');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Authentication & session state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('citizen');

  // Supabase connection state
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

  // Core Data
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [loadingData, setLoadingData] = useState(true);

  // Check Supabase connection and load complaints
  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const config = getStoredSupabaseConfig();
      if (config.isConfigured) {
        const testRes = await testSupabaseConnection(config.url, config.key);
        setIsSupabaseConnected(testRes.success);
      } else {
        setIsSupabaseConnected(false);
      }

      const [complaintsData, deptsData] = await Promise.all([
        dbService.getComplaints(),
        dbService.getDepartments(),
      ]);

      setComplaints(complaintsData);
      setDepartments(deptsData);
    } catch (e) {
      console.error('Error loading complaints data:', e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Maintain Supabase Auth session & listener
  useEffect(() => {
    authService.getSession().then(({ authUser }) => {
      if (authUser) {
        setCurrentUser(authUser);
        setActiveRole(authUser.role);
      }
    });

    const { unsubscribe } = authService.onAuthStateChange((user) => {
      setCurrentUser(user);
      if (user) {
        setActiveRole(user.role);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setActiveRole('citizen');
  };

  // Handle complaint submission redirect to tracking
  const handleComplaintSubmitted = (refNo: string) => {
    setTrackRef(refNo);
    loadData();
  };

  const handleTrackRedirect = (refNo: string) => {
    setTrackRef(refNo);
    setActiveTab('track');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Navbar with role switcher, auth status, and Supabase status indicator */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSupabaseConnected={isSupabaseConnected}
        onOpenConfigModal={() => setIsConfigModalOpen(true)}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Supabase Integration Banner if not configured yet */}
      {!isSupabaseConnected && (
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white px-4 py-2.5 text-xs border-b border-emerald-800">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>
                <strong className="text-emerald-400">Supabase Backend Ready to Connect:</strong>{' '}
                Database schemas & RLS policies are generated. Click here to provide your Supabase
                Project URL and Anon Key.
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition whitespace-nowrap shadow-xs"
              >
                Configure Supabase
              </button>
              <button
                onClick={() => setActiveTab('sql')}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition whitespace-nowrap border border-slate-700"
              >
                View SQL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'submit' && (
          <CitizenComplaintForm
            onComplaintSubmitted={handleComplaintSubmitted}
            onTrackRedirect={handleTrackRedirect}
            existingComplaints={complaints}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'track' && (
          <ComplaintTracker
            initialRefNo={trackRef}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'dashboard' && (
          <OfficerDashboard
            complaints={complaints}
            departments={departments}
            activeRole={activeRole}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            complaints={complaints}
            departments={departments}
            onSelectComplaint={handleTrackRedirect}
          />
        )}

        {activeTab === 'sql' && <SqlSchemaViewer />}
      </main>

      {/* Municipal Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center space-x-2 text-white">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span className="font-extrabold text-base tracking-tight">
                  जनमित्र Janamitra
                </span>
              </div>
              <p className="text-slate-400 max-w-sm text-xs leading-relaxed">
                Municipal Corporation Grievance Redressal & Citizen Empowerment System. Built with
                PostgreSQL & Supabase Row Level Security, GPS geolocation verification, and
                photo-evidence resolution audits.
              </p>
              <div className="flex items-center space-x-4 text-[11px] text-slate-500 pt-1">
                <span>Citizen Helpline: 1912</span>
                <span>&bull;</span>
                <span>Toll-Free: 1800-425-0012</span>
              </div>
            </div>

            <div>
              <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
                Quick Navigation
              </div>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setActiveTab('submit')}
                    className="hover:text-emerald-400 transition"
                  >
                    File New Complaint
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('track')}
                    className="hover:text-emerald-400 transition"
                  >
                    Track Reference #
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="hover:text-emerald-400 transition"
                  >
                    Officer Dashboard
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="hover:text-emerald-400 transition"
                  >
                    Hotspot Analytics Map
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
                Backend Architecture
              </div>
              <ul className="space-y-2 text-slate-400">
                <li>PostgreSQL 15+ Schema</li>
                <li>Supabase Auth & RBAC</li>
                <li>Row Level Security (RLS)</li>
                <li>Bucket: complaint-evidence</li>
                <li>
                  <button
                    onClick={() => setIsConfigModalOpen(true)}
                    className="text-emerald-400 font-semibold hover:underline"
                  >
                    Configure Supabase API Keys
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-3">
            <div>
              &copy; {new Date().getFullYear()} Municipal Corporation of Greater Metropolitan Area. Janamitra Redressal Platform.
            </div>
            <div className="flex items-center space-x-4">
              <span>Privacy Masking Enforced</span>
              <span>&bull;</span>
              <span>Open Data Initiative</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Supabase Configuration Modal */}
      <SupabaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConnectionChange={loadData}
      />

      {/* Supabase Authentication Modal (SignUp & SignIn) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setActiveRole(user.role);
          loadData();
        }}
      />
    </div>
  );
}
