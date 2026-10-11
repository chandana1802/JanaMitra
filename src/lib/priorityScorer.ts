import { ComplaintCategory, ComplaintPriority } from '../types';
import { COMPLAINT_CATEGORIES } from './constants';

export interface PriorityScoreBreakdown {
  totalScore: number;
  priority: ComplaintPriority;
  categoryBase: number;
  keywordScore: number;
  ageBonus: number;
  factors: string[];
}

const CRITICAL_KEYWORDS = [
  { word: 'accident', points: 15, label: 'Reports of vehicular/pedestrian accidents' },
  { word: 'danger', points: 12, label: 'Immediate public safety hazard' },
  { word: 'hazard', points: 12, label: 'Safety hazard flagged' },
  { word: 'injured', points: 18, label: 'Human injury reported' },
  { word: 'hospital', points: 14, label: 'Located near hospital or emergency zone' },
  { word: 'school', points: 12, label: 'Located near school zone or student transit' },
  { word: 'spark', points: 16, label: 'Electrical sparking or live conductor' },
  { word: 'live wire', points: 20, label: 'Exposed live wire risk' },
  { word: 'fire', points: 20, label: 'Fire risk' },
  { word: 'collapsed', points: 15, label: 'Structural or road collapse' },
  { word: 'flooded', points: 12, label: 'Active waterlogging / home ingress' },
  { word: 'elderly', points: 10, label: 'High risk to senior citizens' },
  { word: 'children', points: 10, label: 'Risk to children' },
  { word: 'deep', points: 8, label: 'Deep cavity or severe depression' },
];

export function calculatePriorityScore(
  category: ComplaintCategory,
  description: string,
  createdAt: string = new Date().toISOString()
): PriorityScoreBreakdown {
  const meta = COMPLAINT_CATEGORIES.find((c) => c.id === category);
  const baseWeight = meta ? meta.urgencyWeight * 5 : 30; // 25 - 45
  
  const descLower = description.toLowerCase();
  let keywordPoints = 0;
  const factors: string[] = [`Base category priority: ${meta?.label || category} (+${baseWeight})`];

  for (const item of CRITICAL_KEYWORDS) {
    if (descLower.includes(item.word)) {
      keywordPoints += item.points;
      factors.push(`${item.label} (+${item.points})`);
    }
  }

  // Cap keyword points to 35
  const clampedKeywordPoints = Math.min(keywordPoints, 35);

  // Age factor: +1.5 points per 24 hours elapsed
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffHours = Math.max(0, (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60));
  const ageBonus = Math.min(25, Math.round((diffHours / 24) * 2));
  if (ageBonus > 0) {
    factors.push(`Pending duration: ${Math.round(diffHours)}h (+${ageBonus})`);
  }

  const rawScore = baseWeight + clampedKeywordPoints + ageBonus;
  const totalScore = Math.min(100, Math.max(10, rawScore));

  let priority: ComplaintPriority = 'medium';
  if (totalScore >= 80) {
    priority = 'urgent';
  } else if (totalScore >= 65) {
    priority = 'high';
  } else if (totalScore >= 40) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  return {
    totalScore,
    priority,
    categoryBase: baseWeight,
    keywordScore: clampedKeywordPoints,
    ageBonus,
    factors,
  };
}
