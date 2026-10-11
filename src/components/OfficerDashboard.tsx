import React, { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Building2,
  MapPin,
  Camera,
  ChevronDown,
  Layers,
  ArrowUpDown,
  FileCheck,
  User,
  Shield,
  Eye,
  X,
  Upload,
  Calendar,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  Complaint,
  ComplaintStatus,
  ComplaintPriority,
  Department,
  UserRole,
} from '../types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../lib/constants';
import { dbService } from '../lib/supabase';

interface OfficerDashboardProps {
  complaints: Complaint[];
  departments: Department[];
  activeRole: UserRole;
  onRefreshData: () => void;
}

export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({
  complaints,
  departments,
  activeRole,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority_desc' | 'date_desc' | 'date_asc'>('priority_desc');

  // Active detail modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Status update state inside detail modal
  const [updateStatus, setUpdateStatus] = useState<ComplaintStatus>('in_progress');
  const [officerNotes, setOfficerNotes] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState<File | null>(null);
  const [resolutionPhotoPreview, setResolutionPhotoPreview] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Filter calculations
  const totalCount = complaints.length;
  const pendingCount = complaints.filter(
    (c) => c.status === 'submitted' || c.status === 'under_review'
  ).length;
  const inProgressCount = complaints.filter(
    (c) => c.status === 'assigned' || c.status === 'in_progress' || c.status === 'reopened'
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;
  const urgentCount = complaints.filter(
    (c) => c.priority === 'urgent' && c.status !== 'resolved'
  ).length;

  // Filter logic
  const filteredComplaints = complaints
    .filter((c) => {
      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
      if (selectedDept !== 'all' && c.assigned_department_id !== selectedDept) return false;
      if (selectedPriority !== 'all' && c.priority !== selectedPriority) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchRef = c.reference_no.toLowerCase().includes(query);
        const matchAddr = c.address.toLowerCase().includes(query);
        const matchDesc = c.description.toLowerCase().includes(query);
        const matchCit = (c.citizen_name || '').toLowerCase().includes(query);
        if (!matchRef && !matchAddr && !matchDesc && !matchCit) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority_desc') {
        return (b.priority_score || 0) - (a.priority_score || 0);
      }
      if (sortBy === 'date_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return 0;
    });

  const handleOpenDetail = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setUpdateStatus(
      complaint.status === 'submitted'
        ? 'under_review'
        : complaint.status === 'under_review'
        ? 'assigned'
        : complaint.status === 'assigned'
        ? 'in_progress'
        : 'resolved'
    );
    setOfficerNotes('');
    setResolutionPhoto(null);
    setResolutionPhotoPreview(null);
    setUpdateError(null);
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setUpdateError(null);

    // Enforce resolution photo and notes before marking resolved as per requirements
    if (updateStatus === 'resolved') {
      if (!officerNotes.trim()) {
        setUpdateError('Resolution notes detailing actions taken are required.');
        return;
      }
      if (!resolutionPhoto && !selectedComplaint.evidence?.some((e) => e.evidence_type === 'officer_resolution')) {
        setUpdateError('Photographic proof of resolution is mandatory before marking as Resolved.');
        return;
      }
    }

    setUpdating(true);
    try {
      let uploadedPhoto: { url: string; path: string } | undefined;
      if (resolutionPhoto) {
        uploadedPhoto = await dbService.uploadFile(
          resolutionPhoto,
          selectedComplaint.reference_no,
          'resolution'
        );
      }

      await dbService.updateComplaintStatus(
        selectedComplaint.id,
        updateStatus,
        officerNotes || `Status updated to ${updateStatus} by officer`,
        activeRole === 'admin' ? 'Chief Municipal Commissioner' : 'Nodal Officer Verma',
        uploadedPhoto
      );

      onRefreshData();
      setSelectedComplaint(null);
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title & Officer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-semibold border border-indigo-200 mb-2">
            <Shield className="w-3.5 h-3.5" />
            <span>Nodal Officer & Administration Portal</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Municipal Redressal Dashboard
          </h1>
          <p className="mt-1 text-slate-600 text-sm">
            Live operations monitor for field engineers, nodal departments, and SLA compliance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefreshData}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-8">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Total Logged</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across all wards</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-2">{pendingCount}</div>
          <div className="text-[11px] text-amber-700 mt-1">Awaiting verification</div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-purple-800">
            <span>Active on Ground</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-950 mt-2">{inProgressCount}</div>
          <div className="text-[11px] text-purple-700 mt-1">Assigned / In Progress</div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">{resolvedCount}</div>
          <div className="text-[11px] text-emerald-700 mt-1">Photo-verified</div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800">
            <span>Urgent Attention</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-950 mt-2">{urgentCount}</div>
          <div className="text-[11px] text-rose-700 mt-1">Safety hazards flagged</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search reference #, address, citizen, keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
          </div>

          {/* Department Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="w-full md:w-40">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent Only</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="w-full md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-semibold"
            >
              <option value="priority_desc">Sort: Priority Score &darr;</option>
              <option value="date_desc">Sort: Newest First &darr;</option>
              <option value="date_asc">Sort: Oldest First &uarr;</option>
            </select>
          </div>
        </div>

        {/* Status Pill Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
          {[
            { id: 'all', label: 'All Statuses' },
            { id: 'submitted', label: 'Submitted' },
            { id: 'under_review', label: 'Under Review' },
            { id: 'assigned', label: 'Assigned' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' },
            { id: 'reopened', label: 'Reopened' },
            { id: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedStatus === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Ticket Ref</th>
                <th className="py-3.5 px-4">Category & Details</th>
                <th className="py-3.5 px-4">Location / Ward</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No grievances match the active filters or search criteria.
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((c) => {
                  const statusConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.submitted;
                  const priorityConf = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.medium;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => handleOpenDetail(c)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {c.reference_no}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 capitalize">
                          {c.category.replace('_', ' ')}
                        </div>
                        <div className="text-slate-500 line-clamp-1 text-[11px]">
                          {c.description}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="text-slate-800 line-clamp-1">{c.address}</div>
                        <div className="text-[10px] text-slate-400">{c.ward_no}</div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold border text-[11px] ${priorityConf.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityConf.dot}`} />
                          <span>{priorityConf.label}</span>
                          <span className="text-[9px] opacity-75">({c.priority_score})</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] border ${statusConf.bg} ${statusConf.color} ${statusConf.border}`}
                        >
                          {statusConf.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        {c.department?.code ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono font-bold text-[11px] text-slate-700">
                            {c.department.code}
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(c);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Action Drawer/Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xl font-bold tracking-wider">
                    {selectedComplaint.reference_no}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      STATUS_CONFIG[selectedComplaint.status]?.bg
                    } ${STATUS_CONFIG[selectedComplaint.status]?.color}`}
                  >
                    {STATUS_CONFIG[selectedComplaint.status]?.label}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Logged on {new Date(selectedComplaint.created_at).toLocaleString()} by{' '}
                  {selectedComplaint.citizen_name || 'Citizen'}
                </div>
              </div>

              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Core Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Location & Citizen
                  </div>
                  <div className="font-semibold text-slate-900">{selectedComplaint.address}</div>
                  <div className="text-slate-600">Ward: {selectedComplaint.ward_no}</div>
                  <div className="text-slate-600">
                    Contact: {selectedComplaint.citizen_phone || 'Confidential'} &bull;{' '}
                    {selectedComplaint.citizen_email || 'N/A'}
                  </div>
                  {selectedComplaint.latitude && (
                    <div className="font-mono text-emerald-700 pt-1">
                      GPS: {selectedComplaint.latitude}, {selectedComplaint.longitude}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Department & Urgency
                  </div>
                  <div className="font-semibold text-slate-900">
                    {selectedComplaint.department?.name || 'Central Control'}
                  </div>
                  <div className="text-slate-600">
                    Priority Score: <strong className="text-slate-900">{selectedComplaint.priority_score}/100</strong>{' '}
                    ({selectedComplaint.priority})
                  </div>
                  <div className="text-slate-600">
                    SLA Target: 48 Hours from submission
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Citizen Grievance Statement
                </div>
                <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-line">
                  {selectedComplaint.description}
                </p>
              </div>

              {/* Photos Gallery */}
              {selectedComplaint.evidence && selectedComplaint.evidence.length > 0 && (
                <div>
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">
                    Evidence Photos
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedComplaint.evidence.map((ev, i) => (
                      <div
                        key={ev.id || i}
                        className="rounded-xl overflow-hidden border border-slate-200 aspect-video relative group"
                      >
                        <img
                          src={ev.file_url}
                          alt="Grievance evidence"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[9px] py-0.5 px-2 font-medium capitalize">
                          {ev.evidence_type.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Officer Action Form */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                <div className="font-bold text-indigo-950 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Update Redressal Status & Resolution Proof</span>
                </div>

                <form onSubmit={handleUpdateStatusSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      New Redressal Status *
                    </label>
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value as ComplaintStatus)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                    >
                      <option value="under_review">Under Review (Inspect jurisdiction)</option>
                      <option value="assigned">Assigned (Assign to field gang)</option>
                      <option value="in_progress">In Progress (Field repair crew dispatched)</option>
                      <option value="resolved">Resolved (Work completed & photo proof)</option>
                      <option value="rejected">Rejected (Invalid or out-of-jurisdiction)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Officer Notes / Action Taken {updateStatus === 'resolved' && '*'}
                    </label>
                    <textarea
                      rows={2}
                      required={updateStatus === 'resolved'}
                      placeholder={
                        updateStatus === 'resolved'
                          ? 'Describe exact work performed (e.g., patched 40 sq ft with bitumen, replaced broken cover)...'
                          : 'Notes on progress, gang dispatched, or inspection notes...'
                      }
                      value={officerNotes}
                      onChange={(e) => setOfficerNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>

                  {/* If Resolved is chosen, require Resolution Photograph */}
                  {updateStatus === 'resolved' && (
                    <div className="p-3 rounded-xl bg-white border border-emerald-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                          Upload Resolution Photograph *
                        </label>
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          Required for Resolution
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setResolutionPhoto(e.target.files[0]);
                            setResolutionPhotoPreview(URL.createObjectURL(e.target.files[0]));
                          }
                        }}
                        className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                      {resolutionPhotoPreview && (
                        <div className="rounded-xl overflow-hidden aspect-video max-h-36 border border-slate-200">
                          <img
                            src={resolutionPhotoPreview}
                            alt="Resolution preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {updateError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold text-xs">
                      {updateError}
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedComplaint(null)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                    >
                      {updating ? (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating Record in Supabase...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Commit Status Update</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
