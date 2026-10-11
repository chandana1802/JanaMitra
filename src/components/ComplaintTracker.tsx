import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  FileText,
  RotateCcw,
  Camera,
  ExternalLink,
  ShieldCheck,
  Building2,
  Layers,
  ChevronRight,
  User,
  Share2,
  Eye,
  Check,
  Upload,
} from 'lucide-react';
import { Complaint, ComplaintStatus } from '../types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../lib/constants';
import { dbService } from '../lib/supabase';

interface ComplaintTrackerProps {
  initialRefNo?: string;
  onRefreshData?: () => void;
}

export const ComplaintTracker: React.FC<ComplaintTrackerProps> = ({
  initialRefNo,
  onRefreshData,
}) => {
  const [searchInput, setSearchInput] = useState(initialRefNo || '');
  const [searching, setSearching] = useState(false);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Reopen modal state
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenPhoto, setReopenPhoto] = useState<File | null>(null);
  const [reopenPhotoPreview, setReopenPhotoPreview] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reopenSuccess, setReopenSuccess] = useState(false);

  // Before & After comparison slider state
  const [sliderPos, setSliderPos] = useState(50);

  const fetchComplaint = async (ref: string) => {
    if (!ref.trim()) return;
    setSearching(true);
    setNotFound(false);
    setComplaint(null);

    try {
      const result = await dbService.getComplaintByReferenceNo(ref.trim());
      if (result) {
        setComplaint(result);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch (e) {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (initialRefNo) {
      setSearchInput(initialRefNo);
      fetchComplaint(initialRefNo);
    }
  }, [initialRefNo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchComplaint(searchInput);
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !reopenReason.trim()) return;

    setReopening(true);
    try {
      let uploadedEvidence: { url: string; path: string } | undefined;
      if (reopenPhoto) {
        uploadedEvidence = await dbService.uploadFile(
          reopenPhoto,
          complaint.reference_no,
          'reopen'
        );
      }

      await dbService.reopenComplaint(
        complaint.id,
        reopenReason,
        complaint.citizen_name || 'Citizen',
        uploadedEvidence
      );

      setReopenSuccess(true);
      setIsReopenOpen(false);
      setReopenReason('');
      setReopenPhoto(null);
      setReopenPhotoPreview(null);
      // Refresh current complaint
      fetchComplaint(complaint.reference_no);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to reopen complaint', err);
    } finally {
      setReopening(false);
    }
  };

  // Safe privacy masker for citizen public display
  const maskString = (str?: string) => {
    if (!str) return 'Anonymous Citizen';
    const parts = str.split(' ');
    return parts
      .map((p) => (p.length > 2 ? p[0] + '*'.repeat(p.length - 2) + p[p.length - 1] : p[0] + '*'))
      .join(' ');
  };

  const submissionEvidence = complaint?.evidence?.find((e) => e.evidence_type === 'citizen_submission');
  const resolutionEvidence = complaint?.evidence?.find((e) => e.evidence_type === 'officer_resolution');

  const steps: ComplaintStatus[] = [
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'resolved',
  ];

  const currentStepIndex = complaint ? STATUS_CONFIG[complaint.status]?.step || 1 : 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="text-center sm:text-left mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Track Grievance Status
        </h1>
        <p className="mt-2 text-slate-600 text-sm max-w-2xl">
          Verify real-time field progress, nodal department assignments, status history, and
          photographic resolution evidence.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Enter Complaint Reference Number (e.g. JNM-2026-7842)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm text-slate-800 tracking-wider uppercase"
              required
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-7 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
          >
            {searching ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Track Ticket</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Sample Ref Chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Quick Test Samples:</span>
          {['JNM-2026-7842', 'JNM-2026-5129', 'JNM-2026-9041', 'JNM-2026-3482'].map((ref) => (
            <button
              key={ref}
              type="button"
              onClick={() => {
                setSearchInput(ref);
                fetchComplaint(ref);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 font-mono text-[11px] font-semibold transition"
            >
              {ref}
            </button>
          ))}
        </div>
      </div>

      {/* Not Found Banner */}
      {notFound && (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="font-bold text-base text-rose-900">Reference Number Not Found</h3>
          <p className="text-xs text-rose-700 max-w-md mx-auto">
            No grievance matching &quot;{searchInput}&quot; was found in the municipal database.
            Please double-check the digits or file a new grievance.
          </p>
        </div>
      )}

      {/* Complaint Details Card */}
      {complaint && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Main Card Header */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-2xl font-black text-slate-900 tracking-wider">
                    {complaint.reference_no}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      STATUS_CONFIG[complaint.status]?.bg
                    } ${STATUS_CONFIG[complaint.status]?.color} ${
                      STATUS_CONFIG[complaint.status]?.border
                    }`}
                  >
                    {STATUS_CONFIG[complaint.status]?.label || complaint.status}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                  <span>Registered: {new Date(complaint.created_at).toLocaleDateString()}</span>
                  <span>&bull;</span>
                  <span>{complaint.ward_no || 'Central Ward'}</span>
                  <span>&bull;</span>
                  <span className="capitalize">{complaint.category.replace('_', ' ')}</span>
                </div>
              </div>

              {/* Priority Badge */}
              <div className="flex items-center space-x-2">
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center space-x-1.5 ${
                    PRIORITY_CONFIG[complaint.priority]?.badge
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[complaint.priority]?.dot}`}
                  />
                  <span>Priority: {PRIORITY_CONFIG[complaint.priority]?.label}</span>
                </span>

                {complaint.status === 'resolved' && (
                  <button
                    type="button"
                    onClick={() => setIsReopenOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Grievance</span>
                  </button>
                )}
              </div>
            </div>

            {/* Stepper Progression */}
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                Redressal Lifecycle Stepper
              </div>
              <div className="relative">
                <div className="hidden sm:block absolute top-1/2 left-0 right-0 h-1 bg-slate-200 -translate-y-1/2 z-0"></div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 relative z-10">
                  {steps.map((st, idx) => {
                    const stepNum = idx + 1;
                    const isCompleted = currentStepIndex >= stepNum;
                    const isCurrent = currentStepIndex === stepNum;
                    const config = STATUS_CONFIG[st];

                    return (
                      <div
                        key={st}
                        className={`p-3 rounded-2xl border text-center transition flex flex-col items-center ${
                          isCurrent
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                            : isCompleted
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                            : 'bg-white text-slate-400 border-slate-200'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mb-1.5 ${
                            isCurrent
                              ? 'bg-white text-emerald-700'
                              : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                        </div>
                        <span className="text-xs font-bold">{config.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-600" />
                  <span>Location & Geotag</span>
                </div>
                <div className="text-sm font-semibold text-slate-900">{complaint.address}</div>
                {complaint.landmark && (
                  <div className="text-xs text-slate-500">Landmark: {complaint.landmark}</div>
                )}
                {complaint.latitude && complaint.longitude && (
                  <div className="pt-1 flex items-center justify-between text-xs font-mono text-emerald-800">
                    <span>
                      {complaint.latitude.toFixed(4)}, {complaint.longitude.toFixed(4)}
                    </span>
                    <a
                      href={`https://maps.google.com/?q=${complaint.latitude},${complaint.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 text-emerald-600 hover:underline font-sans font-semibold"
                    >
                      <span>View Map</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Nodal Department Assignment</span>
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {complaint.department?.name || 'Central Municipal Grievance Cell'}
                </div>
                <div className="text-xs text-slate-500">
                  SLA Timeline: Standard {complaint.department?.sla_hours || 48} Hours Resolution
                </div>
                <div className="pt-1 text-xs text-slate-500">
                  Complainant:{' '}
                  <span className="font-semibold text-slate-700">
                    {maskString(complaint.citizen_name)}
                  </span>{' '}
                  (PII Protected)
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Grievance Description
              </div>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {complaint.description}
              </p>
            </div>

            {/* Photographic Verification Gallery (Before & After Slider if Resolved) */}
            {complaint.evidence && complaint.evidence.length > 0 && (
              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Photographic Evidence & Resolution Verification</span>
                </div>

                {/* If both submission and resolution photos exist, show Before & After interactive view */}
                {submissionEvidence && resolutionEvidence ? (
                  <div className="p-4 rounded-3xl bg-slate-900 text-white space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400">
                        Verified Resolution: Before & After Proof
                      </span>
                      <span className="text-slate-400">Interactive Side-by-Side</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-[11px] uppercase font-bold text-amber-400 tracking-wider">
                          Before: Citizen Submission
                        </span>
                        <div className="rounded-2xl overflow-hidden aspect-video border border-slate-700 bg-black">
                          <img
                            src={submissionEvidence.file_url}
                            alt="Before repair"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                          After: Field Crew Resolution
                        </span>
                        <div className="rounded-2xl overflow-hidden aspect-video border border-emerald-500/50 bg-black">
                          <img
                            src={resolutionEvidence.file_url}
                            alt="After repair"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>

                    {complaint.resolution_notes && (
                      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                        <strong className="text-emerald-300">Officer Note:</strong>{' '}
                        {complaint.resolution_notes}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {complaint.evidence.map((ev, i) => (
                      <div
                        key={ev.id || i}
                        className="rounded-2xl overflow-hidden border border-slate-200 aspect-video relative group"
                      >
                        <img
                          src={ev.file_url}
                          alt="Grievance evidence"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[10px] py-1 px-2 font-medium capitalize">
                          {ev.evidence_type.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Status History Timeline Audit Trail */}
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                Redressal Audit Trail & Officer Updates
              </div>

              <div className="space-y-3">
                {complaint.history && complaint.history.length > 0 ? (
                  complaint.history.map((hist, index) => {
                    const conf = STATUS_CONFIG[hist.status] || STATUS_CONFIG.submitted;
                    return (
                      <div
                        key={hist.id || index}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start space-x-3 text-xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shrink-0 shadow-xs">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] uppercase ${conf.bg} ${conf.color}`}
                            >
                              {conf.label}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(hist.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-slate-800 font-medium">{hist.notes}</div>
                          {hist.updated_by_name && (
                            <div className="text-[11px] text-slate-500">
                              Updated by: {hist.updated_by_name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400">No status logs recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Reopening Modal */}
      {isReopenOpen && complaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-rose-600">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-extrabold text-lg text-slate-900">Request Ticket Reopening</h3>
              </div>
              <button
                onClick={() => setIsReopenOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-slate-600">
              If the resolution provided for <strong className="font-mono">{complaint.reference_no}</strong> was
              unsatisfactory, incomplete, or the issue has recurred, submit a reopening request with details.
            </p>

            <form onSubmit={handleReopenSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Reopening *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why the problem is still unresolved on the ground..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Supporting Photo Evidence (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setReopenPhoto(e.target.files[0]);
                      setReopenPhotoPreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
                {reopenPhotoPreview && (
                  <div className="mt-2 rounded-xl overflow-hidden aspect-video max-h-32 border border-slate-200">
                    <img
                      src={reopenPhotoPreview}
                      alt="Reopen proof"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReopenOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reopening || !reopenReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
                >
                  {reopening ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
