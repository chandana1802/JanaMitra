import React, { useState } from 'react';
import {
  MapPin,
  TrendingUp,
  BarChart3,
  Clock,
  Layers,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Complaint, Department } from '../types';
import { COMPLAINT_CATEGORIES } from '../lib/constants';

interface AnalyticsViewProps {
  complaints: Complaint[];
  departments: Department[];
  onSelectComplaint: (refNo: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  complaints,
  departments,
  onSelectComplaint,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Compute category distribution
  const categoryCounts = COMPLAINT_CATEGORIES.map((cat) => {
    const count = complaints.filter((c) => c.category === cat.id).length;
    return {
      category: cat,
      count,
      percentage: complaints.length > 0 ? Math.round((count / complaints.length) * 100) : 0,
    };
  }).sort((a, b) => b.count - a.count);

  // Compute department workloads
  const deptWorkloads = departments.map((dept) => {
    const deptComplaints = complaints.filter((c) => c.assigned_department_id === dept.id);
    const resolved = deptComplaints.filter((c) => c.status === 'resolved').length;
    const pending = deptComplaints.length - resolved;
    return {
      dept,
      total: deptComplaints.length,
      resolved,
      pending,
      rate: deptComplaints.length > 0 ? Math.round((resolved / deptComplaints.length) * 100) : 100,
    };
  });

  // Ward cluster hotspots
  const wardMap = complaints.reduce((acc, c) => {
    const ward = c.ward_no || 'Central Ward';
    acc[ward] = (acc[ward] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const wardHotspots = Object.entries(wardMap)
    .map(([ward, count]) => ({ ward, count }))
    .sort((a, b) => b.count - a.count);

  // Complaints with valid GPS for map clustering
  const geoComplaints = complaints.filter(
    (c) =>
      c.latitude &&
      c.longitude &&
      (selectedCategory === 'all' || c.category === selectedCategory)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 mb-2">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Spatial & Operational Analytics</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Civic Hotspots & SLA Performance
        </h1>
        <p className="mt-1 text-slate-600 text-sm">
          Location-based complaint density clusters, departmental resolution velocity, and grievance patterns.
        </p>
      </div>

      {/* Spatial Hotspot Map / Cluster Visualizer */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span>Geospatial Grievance Hotspot Canvas</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualizing {geoComplaints.length} geotagged incident coordinates across municipal zones
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-semibold">Filter Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
            >
              <option value="all">All Grievances</option>
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Interactive Map Grid Simulation */}
        <div className="relative rounded-2xl bg-slate-950 p-6 sm:p-8 overflow-hidden min-h-[360px] flex flex-col justify-between border border-slate-800 text-white">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px]"></div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 backdrop-blur-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-slate-300 font-bold">Live Municipal Corporation Grid</span>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>Urgent</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>High</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Resolved</span>
              </span>
            </div>
          </div>

          {/* Plotted Incident Markers */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-6">
            {geoComplaints.map((c) => {
              const isUrgent = c.priority === 'urgent';
              const isResolved = c.status === 'resolved';

              return (
                <div
                  key={c.id}
                  onClick={() => onSelectComplaint(c.reference_no)}
                  className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 transition cursor-pointer group shadow-lg flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 group-hover:underline">
                      {c.reference_no}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isResolved
                          ? 'bg-emerald-400'
                          : isUrgent
                          ? 'bg-rose-500 animate-pulse'
                          : 'bg-amber-400'
                      }`}
                    />
                  </div>

                  <div className="text-xs font-semibold text-slate-200 capitalize line-clamp-1">
                    {c.category.replace('_', ' ')}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{c.address}</div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{c.ward_no}</span>
                    <span className="font-mono text-emerald-500/80">
                      {c.latitude?.toFixed(3)}, {c.longitude?.toFixed(3)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Click any coordinate card to inspect tracking details</span>
            <span>Projection: WGS84 Geodetic Datum</span>
          </div>
        </div>
      </div>

      {/* Analytics Grid: Category breakdown & Ward Hotspots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Breakdown */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <span>Grievances by Category</span>
            </h3>
            <span className="text-xs text-slate-400">Total: {complaints.length}</span>
          </div>

          <div className="space-y-3.5">
            {categoryCounts.map((item) => (
              <div key={item.category.id} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{item.category.label}</span>
                  <span className="font-mono text-slate-600">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ward Hotspots & Department Performance */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Ward Grievance Concentration</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {wardHotspots.map((wh) => (
                <div
                  key={wh.ward}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1"
                >
                  <div className="text-xs font-bold text-slate-800">{wh.ward}</div>
                  <div className="text-lg font-black text-slate-900">{wh.count}</div>
                  <div className="text-[10px] text-slate-400">incidents</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2 mb-3">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Departmental Resolution Rates</span>
            </h3>

            <div className="space-y-2.5">
              {deptWorkloads.map((dw) => (
                <div
                  key={dw.dept.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-800">{dw.dept.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {dw.resolved} Resolved &bull; {dw.pending} Pending &bull; SLA {dw.dept.sla_hours}h
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-700">{dw.rate}%</span>
                    <div className="text-[10px] text-slate-400">Resolution</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
