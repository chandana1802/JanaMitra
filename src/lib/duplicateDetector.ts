import { Complaint, ComplaintCategory, DuplicateCheckResult } from '../types';

/**
 * Calculates distance in meters between two lat/lng points using the Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates Jaccard token similarity (0.0 to 1.0)
 */
function calculateTextSimilarity(textA: string, textB: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Checks an incoming complaint against existing open complaints for duplication
 */
export function checkDuplicateComplaint(
  existingComplaints: Complaint[],
  newComplaint: {
    category: ComplaintCategory;
    description: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  }
): DuplicateCheckResult {
  const matches: Complaint[] = [];
  let maxScore = 0;

  // Only consider active/unresolved complaints as duplicates
  const activeComplaints = existingComplaints.filter(
    (c) => c.status !== 'resolved' && c.status !== 'rejected'
  );

  for (const existing of activeComplaints) {
    // Exact category match is usually a prerequisite
    const sameCategory = existing.category === newComplaint.category;
    let locationMatch = false;
    let distanceMeters: number | null = null;

    if (
      newComplaint.latitude &&
      newComplaint.longitude &&
      existing.latitude &&
      existing.longitude
    ) {
      distanceMeters = calculateDistanceMeters(
        newComplaint.latitude,
        newComplaint.longitude,
        existing.latitude,
        existing.longitude
      );
      // Within 250 meters
      if (distanceMeters <= 250) {
        locationMatch = true;
      }
    }

    const textSim = calculateTextSimilarity(
      newComplaint.description + ' ' + (newComplaint.address || ''),
      existing.description + ' ' + (existing.address || '')
    );

    // Scoring weights
    let score = 0;
    if (sameCategory) score += 40;
    if (locationMatch && distanceMeters !== null) {
      // Closer distance = higher score
      const proximityScore = Math.max(0, 40 * (1 - distanceMeters / 250));
      score += proximityScore;
    }
    score += textSim * 30;

    if (score >= 55) {
      matches.push(existing);
      if (score > maxScore) maxScore = score;
    }
  }

  if (matches.length > 0) {
    const topMatch = matches[0];
    return {
      isDuplicate: true,
      score: Math.round(maxScore),
      matches,
      warningMessage: `A similar ${newComplaint.category.replace('_', ' ')} complaint (#${topMatch.reference_no}) was already registered nearby on "${topMatch.address}". You can track or reinforce that report.`,
    };
  }

  return {
    isDuplicate: false,
    score: 0,
    matches: [],
  };
}
