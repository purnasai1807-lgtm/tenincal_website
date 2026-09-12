import { EventItem, StudentRegistration, User, AnalyticsData, LoadBalancerMetrics, NotificationItem, EventQrInfo, VenueCheckInResult, CodingTestSummary, CodingTestDetail, AdminCodingTest, TestScore, LeaderboardResponse, Achievement, MyCertificate, AdminCertificateTemplate, AdminCertificateApproval } from '../types';

const TOKEN_KEY = 'synapse_jwt_token';
const USER_KEY = 'synapse_user_data';

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  setUser(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      if (data.error) errorMsg = data.error;
    } catch (e) {
      // response might not be JSON
    }
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text() as unknown as T;
}

export const api = {
  // Auth
  async login(usernameOrEmail: string, password: string) {
    const res = await apiFetch<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
    return res;
  },

  async registerUser(data: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    rollNumber?: string;
    year?: string;
    section?: string;
    avatarUrl?: string;
  }) {
    const res = await apiFetch<{ success: boolean; token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    authStorage.setToken(res.token);
    authStorage.setUser(res.user);
    return res;
  },

  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore network errors on logout
    } finally {
      authStorage.clear();
    }
  },

  async getMe() {
    return apiFetch<{ user: User }>('/api/auth/me');
  },

  async requestPasswordReset(usernameOrEmail: string) {
    return apiFetch<{ success: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail }),
    });
  },

  async resetPassword(token: string, password: string) {
    return apiFetch<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async createAdminPasswordResetToken(userId: string) {
    return apiFetch<{ success: boolean; resetToken: string; expiresInMinutes: number; message: string }>(
      `/api/admin/users/${userId}/password-reset-token`,
      { method: 'POST' }
    );
  },

  // Events
  async getEvents(): Promise<EventItem[]> {
    return apiFetch<EventItem[]>('/api/events');
  },

  async getEvent(id: string): Promise<EventItem> {
    return apiFetch<EventItem>(`/api/events/${id}`);
  },

  async createEvent(eventData: Partial<EventItem>): Promise<{ success: boolean; message: string; event: EventItem }> {
    return apiFetch('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  async updateEvent(id: string, eventData: Partial<EventItem>): Promise<{ success: boolean; message: string; event: EventItem }> {
    return apiFetch(`/api/admin/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(eventData),
    });
  },

  async deleteEvent(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/admin/events/${id}`, {
      method: 'DELETE',
    });
  },

  // Registration
  async registerForEvent(payload: {
    fullName: string;
    email: string;
    phone: string;
    rollNumber: string;
    year: string;
    section: string;
    eventId: string;
    ticketTier?: string;
    ticketPrice?: number;
    paymentId?: string;
    paymentStatus?: string;
    notes?: string;
  }): Promise<{ success: boolean; registration_id: string; registration: StudentRegistration }> {
    return apiFetch('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMyRegistrations(): Promise<StudentRegistration[]> {
    return apiFetch<StudentRegistration[]>('/api/my-registrations');
  },

  // Notifications
  async getNotifications(): Promise<NotificationItem[]> {
    return apiFetch<NotificationItem[]>('/api/notifications');
  },

  // Admin APIs
  async getAdminStudents(params?: {
    search?: string;
    year?: string;
    section?: string;
    eventId?: string;
    sort?: string;
    attended?: string;
  }): Promise<{ total: number; students: StudentRegistration[] }> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.append(k, v);
      });
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/api/admin/students${qs}`);
  },

  async toggleCheckIn(studentId: string): Promise<{ success: boolean; attended: boolean; checkInTime?: string }> {
    return apiFetch(`/api/admin/students/${studentId}/checkin`, {
      method: 'PATCH',
    });
  },

  async deleteStudent(studentId: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
    });
  },

  async getAdminAnalytics(): Promise<AnalyticsData> {
    return apiFetch<AnalyticsData>('/api/admin/analytics');
  },

  async broadcastNotification(payload: {
    title: string;
    message: string;
    type: 'reminder' | 'update' | 'announcement';
    eventId?: string;
  }) {
    return apiFetch('/api/admin/broadcast-notification', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getDownloadCsvUrl(): Promise<string> {
    const token = authStorage.getToken();
    const res = await fetch('/api/admin/export', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to download CSV');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  async getDownloadLoginAccountsCsvUrl(): Promise<string> {
    const token = authStorage.getToken();
    const res = await fetch('/api/admin/login-accounts/export', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error('Failed to download login accounts CSV');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // High-concurrency metrics
  async getLoadMetrics(): Promise<LoadBalancerMetrics> {
    return apiFetch<LoadBalancerMetrics>('/api/system/load-metrics');
  },

  async simulateLoad(concurrency = 2000): Promise<any> {
    return apiFetch('/api/system/simulate-load', {
      method: 'POST',
      body: JSON.stringify({ concurrency }),
    });
  },

  // Site-Wide Event Celebration & Fireworks
  async triggerCelebration(payload: {
    eventId?: string;
    eventTitle?: string;
    message?: string;
  }): Promise<{ success: boolean; celebration: any }> {
    return apiFetch('/api/celebration', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getCurrentCelebration(): Promise<{ active: boolean; celebration: any | null; remainingMs?: number }> {
    return apiFetch('/api/celebration/current');
  },

  async stopCelebration(): Promise<{ success: boolean }> {
    return apiFetch('/api/celebration', {
      method: 'DELETE',
    });
  },

  // Venue Attendance QR & Student Check-In
  async getEventQrInfo(eventId: string): Promise<EventQrInfo> {
    return apiFetch<EventQrInfo>(`/api/events/${eventId}/qr-info`);
  },

  async refreshEventVenueToken(eventId: string): Promise<{ success: boolean; eventId: string; token: string; message: string }> {
    return apiFetch(`/api/events/${eventId}/refresh-token`, {
      method: 'POST',
    });
  },

  async venueCheckIn(eventId: string, identifier: string, token?: string): Promise<VenueCheckInResult> {
    return apiFetch<VenueCheckInResult>(`/api/events/${eventId}/venue-checkin`, {
      method: 'POST',
      body: JSON.stringify({ identifier, token }),
    });
  },

  async venueCheckOut(eventId: string, identifier: string, token?: string): Promise<{ checkedOut: boolean; checkOutTime: string; message: string }> {
    return apiFetch(`/api/events/${eventId}/entry-pass/checkout`, {
      method: 'POST',
      body: JSON.stringify({ identifier, token }),
    });
  },

  // Member Dashboard: Coding Tests
  async getMyTests(): Promise<CodingTestSummary[]> {
    return apiFetch<CodingTestSummary[]>('/api/tests');
  },

  async getTestToAttempt(testId: string): Promise<CodingTestDetail> {
    return apiFetch<CodingTestDetail>(`/api/tests/${testId}`);
  },

  async submitTest(testId: string, answers: number[]): Promise<{ success: boolean; score: number; totalMarks: number }> {
    return apiFetch(`/api/tests/${testId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  async getMyTestScores(): Promise<TestScore[]> {
    return apiFetch<TestScore[]>('/api/tests/scores/mine');
  },

  async getLeaderboard(): Promise<LeaderboardResponse> {
    return apiFetch<LeaderboardResponse>('/api/leaderboard');
  },

  async getMyAchievements(): Promise<Achievement[]> {
    return apiFetch<Achievement[]>('/api/achievements/mine');
  },

  async getMyCertificates(): Promise<MyCertificate[]> {
    return apiFetch<MyCertificate[]>('/api/certificates/mine');
  },

  async updateProfile(payload: { fullName?: string; year?: string; section?: string; avatarUrl?: string }): Promise<{ success: boolean; user: User }> {
    const res = await apiFetch<{ success: boolean; user: User }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    authStorage.setUser(res.user);
    return res;
  },

  // Admin: Coding Tests
  async getAdminTests(): Promise<AdminCodingTest[]> {
    return apiFetch<AdminCodingTest[]>('/api/admin/tests');
  },

  async createTest(payload: Partial<AdminCodingTest>): Promise<{ success: boolean; test: AdminCodingTest }> {
    return apiFetch('/api/admin/tests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTest(id: string, payload: Partial<AdminCodingTest>): Promise<{ success: boolean; test: AdminCodingTest }> {
    return apiFetch(`/api/admin/tests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteTest(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/admin/tests/${id}`, { method: 'DELETE' });
  },

  // Admin: Achievements
  async awardAchievement(payload: { identifier: string; title: string; description?: string; icon?: string }) {
    return apiFetch('/api/admin/achievements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async revokeAchievement(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/admin/achievements/${id}`, { method: 'DELETE' });
  },

  // Admin: Certificate Templates & Approvals
  async getAdminCertificateTemplates(): Promise<AdminCertificateTemplate[]> {
    return apiFetch<AdminCertificateTemplate[]>('/api/admin/certificate-templates');
  },

  async createCertificateTemplate(payload: {
    name: string;
    eventId?: string;
    imageData: string;
    nameX?: number;
    nameY?: number;
    fontSize?: number;
    fontColor?: string;
    fontFamily?: string;
  }): Promise<{ success: boolean; template: AdminCertificateTemplate }> {
    return apiFetch('/api/admin/certificate-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteCertificateTemplate(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/admin/certificate-templates/${id}`, { method: 'DELETE' });
  },

  async approveCertificate(payload: { identifier: string; templateId: string; eventId?: string; note?: string }) {
    return apiFetch('/api/admin/certificates/approve', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAdminCertificateApprovals(): Promise<AdminCertificateApproval[]> {
    return apiFetch<AdminCertificateApproval[]>('/api/admin/certificates');
  },

  async revokeCertificateApproval(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/admin/certificates/${id}`, { method: 'DELETE' });
  },
};
