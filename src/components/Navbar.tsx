import React from 'react';
import {
  Shield,
  FileText,
  Search,
  LayoutDashboard,
  MapPin,
  Database,
  UserCheck,
  ChevronDown,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';
import { UserRole, AuthUser } from '../types';

interface NavbarProps {
  activeTab: 'submit' | 'track' | 'dashboard' | 'analytics' | 'sql';
  setActiveTab: (tab: 'submit' | 'track' | 'dashboard' | 'analytics' | 'sql') => void;
  isSupabaseConnected: boolean;
  onOpenConfigModal: () => void;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentUser: AuthUser | null;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isSupabaseConnected,
  onOpenConfigModal,
  activeRole,
  onRoleChange,
  currentUser,
  onOpenAuthModal,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top Municipal Banner */}
      <div className="bg-slate-900 text-slate-300 px-4 py-1.5 text-xs flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium text-slate-200">
            Municipal Corporation Grievance Redressal Portal
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-400">Citizen Helpline: 1912 / 080-22221100</span>
        </div>

        {/* Supabase connection pill */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenConfigModal}
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition ${
              isSupabaseConnected
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>{isSupabaseConnected ? 'Supabase Online' : 'Connect Supabase'}</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Emblem */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('submit')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  जनमित्र <span className="text-emerald-600 font-bold">Janamitra</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Citizen Grievance & Public Redressal System
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center space-x-2 ${
                activeTab === 'submit'
                  ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>File Complaint</span>
            </button>

            <button
              onClick={() => setActiveTab('track')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center space-x-2 ${
                activeTab === 'track'
                  ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Track Grievance</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center space-x-2 ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Officer Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center space-x-2 ${
                activeTab === 'analytics'
                  ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Hotspot Map</span>
            </button>

            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center space-x-2 ${
                activeTab === 'sql'
                  ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>SQL Migrations</span>
            </button>
          </nav>

          {/* Right User & Role Controls */}
          <div className="flex items-center space-x-2.5">
            {/* Authenticated user vs Sign In */}
            {currentUser ? (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-2xl py-1 px-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  {currentUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {currentUser.full_name}
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize">
                    {currentUser.role}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign Out"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Register</span>
              </button>
            )}

            {/* Role Switcher */}
            <div className="relative group">
              <button className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition text-xs font-semibold text-slate-800">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="capitalize hidden sm:inline">
                  {activeRole === 'citizen'
                    ? 'Citizen View'
                    : activeRole === 'officer'
                    ? 'Officer View'
                    : 'Admin View'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 hidden group-hover:block transition z-50">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400">
                  Switch Active Role
                </div>
                <button
                  onClick={() => onRoleChange('citizen')}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${
                    activeRole === 'citizen' ? 'text-emerald-700 font-bold bg-emerald-50/50' : 'text-slate-700'
                  }`}
                >
                  <span>Citizen (Public)</span>
                  {activeRole === 'citizen' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                </button>
                <button
                  onClick={() => onRoleChange('officer')}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${
                    activeRole === 'officer' ? 'text-indigo-700 font-bold bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  <span>Field Officer (Nodal)</span>
                  {activeRole === 'officer' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                </button>
                <button
                  onClick={() => onRoleChange('admin')}
                  className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center justify-between ${
                    activeRole === 'admin' ? 'text-purple-700 font-bold bg-purple-50/50' : 'text-slate-700'
                  }`}
                >
                  <span>Municipal Admin</span>
                  {activeRole === 'admin' && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile tabs row */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-100 scrollbar-none">
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'submit' ? 'bg-emerald-600 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            File Complaint
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'track' ? 'bg-emerald-600 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            Track
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            Officer
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-emerald-600 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            Hotspots
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'sql' ? 'bg-emerald-600 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            SQL
          </button>
        </div>
      </div>
    </header>
  );
};
