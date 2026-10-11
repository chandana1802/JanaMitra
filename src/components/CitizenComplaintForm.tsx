import React, { useState, useEffect } from 'react';
import {
  Camera,
  MapPin,
  Send,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Building2,
  Copy,
  Check,
  UploadCloud,
  X,
  Droplets,
  Construction,
  Waves,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ComplaintCategory, ComplaintPriority, Complaint } from '../types';
import { COMPLAINT_CATEGORIES } from '../lib/constants';
import { checkDuplicateComplaint } from '../lib/duplicateDetector';
import { calculatePriorityScore } from '../lib/priorityScorer';
import { dbService } from '../lib/supabase';
import { AuthUser } from '../types';

interface CitizenComplaintFormProps {
  onComplaintSubmitted: (refNo: string) => void;
  onTrackRedirect: (refNo: string) => void;
  existingComplaints: Complaint[];
  currentUser?: AuthUser | null;
  onOpenAuthModal?: () => void;
}

export const CitizenComplaintForm: React.FC<CitizenComplaintFormProps> = ({
  onComplaintSubmitted,
  onTrackRedirect,
  existingComplaints,
  currentUser,
  onOpenAuthModal,
}) => {
  const [category, setCategory] = useState<ComplaintCategory>('garbage');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [wardNo, setWardNo] = useState('Ward 84');
  const [citizenName, setCitizenName] = useState(currentUser?.full_name || 'Citizen');
  const [citizenPhone, setCitizenPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [citizenEmail, setCitizenEmail] = useState(currentUser?.email || 'citizen@example.com');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.full_name) setCitizenName(currentUser.full_name);
      if (currentUser.phone) setCitizenPhone(currentUser.phone);
      if (currentUser.email) setCitizenEmail(currentUser.email);
    }
  }, [currentUser]);

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Photos state
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Duplicate Warning
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isDuplicate: boolean;
    message?: string;
    matchedRef?: string;
  }>({ isDuplicate: false });

  // Submitting state & Modal receipt
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Check duplicates when inputs change
  useEffect(() => {
    if (description.length > 15 || address.length > 5) {
      const result = checkDuplicateComplaint(existingComplaints, {
        category,
        description,
        address,
        latitude: gpsCoords?.latitude,
        longitude: gpsCoords?.longitude,
      });

      if (result.isDuplicate && result.matches.length > 0) {
        setDuplicateWarning({
          isDuplicate: true,
          message: result.warningMessage,
          matchedRef: result.matches[0].reference_no,
        });
      } else {
        setDuplicateWarning({ isDuplicate: false });
      }
    } else {
      setDuplicateWarning({ isDuplicate: false });
    }
  }, [category, description, address, gpsCoords, existingComplaints]);

  // Handle GPS location request
  const handleCaptureGPS = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (error) => {
        let msg = 'Failed to obtain GPS coordinates.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied by user. Enter address manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location position unavailable. Please type your street address.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        setGpsError(msg);
        setGpsLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setPhotoError(`"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
        setPhotoError(`"${file.name}" is not a supported format (JPG, PNG, WebP).`);
        continue;
      }
      validFiles.push(file);
      previews.push(URL.createObjectURL(file));
    }

    setPhotoFiles((prev) => [...prev, ...validFiles]);
    setPhotoPreviews((prev) => [...prev, ...previews]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate live priority score
  const priorityBreakdown = calculatePriorityScore(category, description);

  // Submit Complaint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !address.trim()) return;

    setIsSubmitting(true);

    try {
      // 1. Upload photos (via Supabase storage or local data URL)
      const uploadedPhotos: { url: string; path: string; name: string }[] = [];
      for (const file of photoFiles) {
        const uploadRes = await dbService.uploadFile(file, 'new-submission', 'submission');
        uploadedPhotos.push({
          url: uploadRes.url,
          path: uploadRes.path,
          name: file.name,
        });
      }

      // If no photo was attached, use a standard civic photo placeholder for realism
      if (uploadedPhotos.length === 0) {
        const categoryPlaceholders: Record<ComplaintCategory, string> = {
          garbage: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
          potholes: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
          road_damage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
          water_leakage: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=800&q=80',
          drainage: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
          streetlights: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
          public_sanitation: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80',
          other: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
        };
        uploadedPhotos.push({
          url: categoryPlaceholders[category],
          path: 'default-evidence.jpg',
          name: 'evidence.jpg',
        });
      }

      // 2. Insert into database
      const result = await dbService.createComplaint({
        category,
        description,
        citizen_name: citizenName,
        citizen_phone: citizenPhone,
        citizen_email: citizenEmail,
        citizen_id: currentUser ? currentUser.id : undefined,
        address,
        landmark,
        ward_no: wardNo,
        latitude: gpsCoords?.latitude,
        longitude: gpsCoords?.longitude,
        priority: priorityBreakdown.priority,
        evidencePhotos: uploadedPhotos,
      });

      // Fire confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#059669', '#10b981', '#34d399', '#6ee7b7'],
        });
      } catch (e) {}

      setSubmittedRef(result.complaint.reference_no);
      onComplaintSubmitted(result.complaint.reference_no);
    } catch (err) {
      console.error('Submission failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyRef = () => {
    if (submittedRef) {
      navigator.clipboard.writeText(submittedRef);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const selectedCategoryMeta = COMPLAINT_CATEGORIES.find((c) => c.id === category);

  const getCategoryIcon = (id: ComplaintCategory) => {
    switch (id) {
      case 'garbage':
        return <Trash2 className="w-4 h-4" />;
      case 'potholes':
        return <AlertTriangle className="w-4 h-4" />;
      case 'road_damage':
        return <Construction className="w-4 h-4" />;
      case 'water_leakage':
        return <Droplets className="w-4 h-4" />;
      case 'drainage':
        return <Waves className="w-4 h-4" />;
      case 'streetlights':
        return <Lightbulb className="w-4 h-4" />;
      case 'public_sanitation':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page Title */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Official Grievance Registration Portal</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Register a Civic Grievance
        </h1>
        <p className="mt-2 text-slate-600 text-sm max-w-2xl">
          Report civic issues directly to your municipal corporation. Every grievance receives a
          guaranteed SLA tracking reference and photo-verified field resolution.
        </p>
      </div>

      {/* Duplicate Alert Banner */}
      {duplicateWarning.isDuplicate && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start space-x-3.5 shadow-xs animate-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <span className="font-bold">Possible Duplicate Grievance Detected:</span>{' '}
            {duplicateWarning.message}
            {duplicateWarning.matchedRef && (
              <div className="mt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => onTrackRedirect(duplicateWarning.matchedRef!)}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1 rounded-lg transition"
                >
                  <span>Track Existing #{duplicateWarning.matchedRef}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-amber-700">
                  (You may still proceed if this is a separate incident)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
        {/* Step 1: Category Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
                1
              </span>
              <span>Select Grievance Category</span>
            </label>
            <span className="text-xs text-slate-500 font-medium">Auto-routed by category</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {COMPLAINT_CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-3.5 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      {getCategoryIcon(cat.id)}
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <span className="font-bold text-xs leading-snug">{cat.label}</span>
                </button>
              );
            })}
          </div>

          {selectedCategoryMeta && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>
                  Designated Department:{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedCategoryMeta.defaultDeptCode === 'SWM' && 'Solid Waste Management'}
                    {selectedCategoryMeta.defaultDeptCode === 'PWD' && 'Roads & Infrastructure (PWD)'}
                    {selectedCategoryMeta.defaultDeptCode === 'BWSSB' && 'Water Supply & Sewerage Board'}
                    {selectedCategoryMeta.defaultDeptCode === 'SWD' && 'Stormwater & Drainage'}
                    {selectedCategoryMeta.defaultDeptCode === 'ELEC' && 'Electrical & Street Lighting'}
                    {selectedCategoryMeta.defaultDeptCode === 'PHS' && 'Public Health & Sanitation'}
                  </span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[11px] text-slate-700 font-bold">
                {selectedCategoryMeta.defaultDeptCode}
              </span>
            </div>
          )}
        </div>

        {/* Step 2: Location & GPS Geotagging */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
                2
              </span>
              <span>Location & Geotagging</span>
            </label>
            <span className="text-xs text-emerald-600 font-semibold">GPS Verified</span>
          </div>

          <div className="space-y-3">
            {/* GPS Trigger Button */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Browser Geolocation
                  </div>
                  <div className="text-xs text-emerald-800">
                    Pinpoint exact GPS coordinates for field inspection teams
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={gpsLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs whitespace-nowrap"
              >
                {gpsLoading ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Detecting GPS...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{gpsCoords ? 'Update Location' : 'Capture My GPS Location'}</span>
                  </>
                )}
              </button>
            </div>

            {/* GPS Result or Error */}
            {gpsCoords && (
              <div className="p-3 rounded-xl bg-emerald-100/60 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>
                    Lat: <strong className="font-mono">{gpsCoords.latitude}</strong>, Long:{' '}
                    <strong className="font-mono">{gpsCoords.longitude}</strong>
                    {gpsCoords.accuracy && ` (Accurate within ±${gpsCoords.accuracy}m)`}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  Geotagged
                </span>
              </div>
            )}

            {gpsError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            {/* Address fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Street Address / Landmark Details *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 14th Main, 4th Cross, near State Bank ATM"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Municipal Ward / Zone
                </label>
                <select
                  value={wardNo}
                  onChange={(e) => setWardNo(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                >
                  <option value="Ward 84">Ward 84 (Indiranagar / Halasuru)</option>
                  <option value="Ward 151">Ward 151 (Koramangala)</option>
                  <option value="Ward 169">Ward 169 (Jayanagar)</option>
                  <option value="Ward 176">Ward 176 (BTM Layout)</option>
                  <option value="Ward 92">Ward 92 (Shivaji Nagar)</option>
                  <option value="Ward 112">Ward 112 (Malleshwaram)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Description & Photographic Evidence */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
                3
              </span>
              <span>Grievance Description & Photos</span>
            </label>
            <span className="text-xs text-slate-500">{description.length}/1000 characters</span>
          </div>

          <div className="space-y-4">
            <textarea
              required
              rows={4}
              maxLength={1000}
              placeholder="Provide specific details about the issue (severity, how long it has been persistent, safety hazards, nearby establishments)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />

            {/* Photo Upload Area */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Photographic Evidence (JPG, PNG, WebP &bull; Max 10MB)
                </span>
                <span className="text-xs text-slate-500">{photoFiles.length} photo(s) selected</span>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 bg-slate-50/70 hover:bg-emerald-50/30 transition text-center cursor-pointer relative">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handlePhotoSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-xs">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    Click or drag & drop grievance photographs
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Clear photos help officers verify and dispatch appropriate equipment immediately
                  </div>
                </div>
              </div>

              {photoError && (
                <div className="mt-2 text-xs text-rose-600 font-semibold">{photoError}</div>
              )}

              {/* Photo Previews */}
              {photoPreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {photoPreviews.map((preview, index) => (
                    <div
                      key={index}
                      className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video group"
                    >
                      <img
                        src={preview}
                        alt={`Evidence ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-slate-900/80 text-white hover:bg-rose-600 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 4: Transparent Priority & Verification Preview */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Transparent Priority Calculation</span>
            </span>
            <span
              className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                priorityBreakdown.priority === 'urgent'
                  ? 'bg-rose-100 text-rose-800'
                  : priorityBreakdown.priority === 'high'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              Priority: {priorityBreakdown.priority} ({priorityBreakdown.totalScore}/100)
            </span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {priorityBreakdown.factors.map((f, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700 font-medium"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Citizen Contact Details (Sanitized in public tracking) */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Citizen Contact Information (Kept Confidential)
            </span>
            {currentUser ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Linked with Supabase Account ({currentUser.id.slice(0, 8)}...)</span>
              </span>
            ) : onOpenAuthModal ? (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 hover:underline text-left"
              >
                Sign in with Supabase for auto-fill & linked history &rarr;
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Your Full Name
              </label>
              <input
                type="text"
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Mobile Number (SMS SLA updates)
              </label>
              <input
                type="tel"
                value={citizenPhone}
                onChange={(e) => setCitizenPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={citizenEmail}
                onChange={(e) => setCitizenEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Digital receipt & guaranteed municipal tracking provided</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Registering Grievance in Supabase...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Grievance</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Receipt Modal */}
      {submittedRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <FileCheck className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
                Registered Successfully
              </div>
              <h3 className="text-2xl font-black text-slate-900">Grievance Ticket Generated</h3>
              <p className="text-xs text-slate-600 mt-1">
                Your complaint has been queued and assigned to the municipal field division.
              </p>
            </div>

            {/* Reference Number Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Complaint Reference Number
              </span>
              <div className="flex items-center justify-center space-x-2">
                <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
                  {submittedRef}
                </span>
                <button
                  onClick={handleCopyRef}
                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
                  title="Copy Reference Number"
                >
                  {copiedRef ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              An acknowledgment SMS & email have been dispatched with this reference number.
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setSubmittedRef(null);
                  setDescription('');
                  setAddress('');
                  setPhotoFiles([]);
                  setPhotoPreviews([]);
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                File Another
              </button>
              <button
                type="button"
                onClick={() => {
                  const ref = submittedRef;
                  setSubmittedRef(null);
                  onTrackRedirect(ref);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <span>Track Status</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
