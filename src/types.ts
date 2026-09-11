export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  rollNumber?: string;
  year?: string;
  section?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: string;
  issuedAt: string;
}

export type EventCategory = 'workshop' | 'hackathon' | 'bootcamp' | 'seminar';

export interface EventItem {
  id: string;
  title: string;
  category: EventCategory;
  tagline: string;
  description: string;
  organizer: string;
  coOrganizer?: string;
  dates: string;
  venue: string;
  targetAudience: string;
  price: number; // 0 for free
  capacity: number;
  registeredCount: number;
  topics: string[];
  schedule: {
    day: string;
    title: string;
    time: string;
    description: string;
  }[];
  speakers: {
    name: string;
    role: string;
    organization: string;
    avatar: string;
  }[];
  isFlagship?: boolean;
}

export interface StudentRegistration {
  id: string;
  registrationId: string; // e.g. WIDS26-00427
  fullName: string;
  email: string;
  phone: string;
  rollNumber: string;
  year: '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
  section: 'A' | 'B' | 'C' | 'D' | 'Other';
  eventId: string;
  eventTitle: string;
  ticketTier: string;
  ticketPrice: number;
  paymentStatus: 'free_confirmed' | 'paid' | 'pending';
  paymentId?: string;
  registeredAt: string;
  attended: boolean;
  checkInTime?: string;
  notes?: string;
  qrToken?: string;
  qrPayload?: string;
}

export interface NotificationItem {
  id: string;
  eventId?: string;
  title: string;
  message: string;
  type: 'reminder' | 'update' | 'announcement' | 'urgent';
  createdAt: string;
  targetRole?: 'all' | 'students' | 'admin';
  isRead?: boolean;
}

export interface AnalyticsData {
  totalRegistrations: number;
  firstYearCount: number;
  secondYearCount: number;
  thirdYearCount: number;
  fourthYearCount: number;
  todayRegistrations: number;
  totalRevenue: number;
  sectionBreakdown: {
    A: number;
    B: number;
    C: number;
    D: number;
    Other: number;
  };
  eventBreakdown: {
    eventId: string;
    title: string;
    count: number;
    capacity: number;
  }[];
  attendanceRate: number;
  dailyRegistrations: {
    date: string;
    rawDate?: string;
    count: number;
    cumulative?: number;
    byEvent?: Record<string, number>;
  }[];
}

export interface WorkerNodeMetrics {
  nodeId: string;
  status: 'healthy' | 'busy' | 'rebalancing';
  activeConnections: number;
  requestsHandled: number;
  cpuUsage: number;
  memoryUsage: number;
  avgLatencyMs: number;
  lastHeartbeat: string;
}

export interface LoadBalancerMetrics {
  totalRequestsHandled: number;
  requestsPerSecond: number;
  averageLatencyMs: number;
  activeConcurrentUsers: number;
  clusterHealth: 'optimal' | 'high_load' | 'critical';
  algorithm: 'Round Robin with Weighted Least Connections';
  nodes: WorkerNodeMetrics[];
  p99LatencyMs: number;
  errorRate: number;
}

export interface EventQrInfo {
  eventId: string;
  title: string;
  category: EventCategory;
  dates: string;
  venue: string;
  token: string;
  capacity: number;
  registeredCount: number;
  attendedCount: number;
  recentCheckins: StudentRegistration[];
}

export interface VenueCheckInResult {
  success: boolean;
  alreadyCheckedIn?: boolean;
  newlyCheckedIn?: boolean;
  message: string;
  student: StudentRegistration;
  checkInTime: string;
  event: {
    id: string;
    title: string;
    venue: string;
    dates: string;
  };
}

// --- Member Dashboard: Coding Tests, Leaderboard, Achievements, Certificates ---

export interface TestQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  marks: number;
}

export interface CodingTestSummary {
  id: string;
  title: string;
  description: string;
  eventId?: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  hasAttempted: boolean;
}

export interface CodingTestDetail {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  totalMarks: number;
  questions: Omit<TestQuestion, 'correctIndex'>[];
}

export interface AdminCodingTest {
  id: string;
  title: string;
  description: string;
  eventId?: string;
  durationMinutes: number;
  questions: TestQuestion[];
  totalMarks: number;
  isPublished: boolean;
  createdAt: string;
  createdBy?: string;
}

export interface TestScore {
  testId: string;
  testTitle: string;
  score: number;
  totalMarks: number;
  submittedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  fullName: string;
  rollNumber?: string;
  totalScore: number;
  testsTaken: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  myRank: { rank: number; totalScore: number; testsTaken: number } | null;
}

export interface Achievement {
  id: string;
  userId: string;
  title: string;
  description: string;
  icon: string;
  awardedAt: string;
  awardedBy?: string;
}

export interface CertificateTemplateInfo {
  id: string;
  name: string;
  imageData: string;
  nameX: number;
  nameY: number;
  fontSize: number;
  fontColor: string;
}

export interface MyCertificate {
  id: string;
  approvedAt: string;
  note?: string;
  template: CertificateTemplateInfo | null;
}

export interface AdminCertificateTemplate {
  id: string;
  name: string;
  eventId?: string;
  imageData: string;
  nameX: number;
  nameY: number;
  fontSize: number;
  fontColor: string;
  createdAt: string;
  createdBy?: string;
}

export interface AdminCertificateApproval {
  id: string;
  templateId: string;
  userId: string;
  eventId?: string;
  status: 'approved' | 'pending' | 'rejected';
  note?: string;
  approvedAt: string;
  approvedBy?: string;
  fullName?: string;
  rollNumber?: string;
}
