import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Ticket,
  QrCode,
  Calendar,
  MapPin,
  Printer,
  User as UserIcon,
  Clock,
  CheckCircle2,
  BookOpen,
  Sparkles,
  ArrowRight,
  Trophy,
  Award,
  FileBadge,
  Bell,
  LayoutGrid,
  ListChecks,
  Timer,
  Download,
  Loader2,
  AlertCircle,
  Star,
  Medal,
  Save,
} from 'lucide-react';
import {
  StudentRegistration,
  User,
  EventItem,
  NotificationItem,
  CodingTestSummary,
  CodingTestDetail,
  TestScore,
  LeaderboardResponse,
  Achievement,
  MyCertificate,
} from '../types';
import { api } from '../services/api';

interface MemberDashboardProps {
  currentUser: User | null;
  events: EventItem[];
  notifications: NotificationItem[];
  onOpenAuth: () => void;
  onSelectRegistration: (reg: StudentRegistration) => void;
  onBrowseEvents: () => void;
}

type MemberTab =
  | 'overview'
  | 'tests'
  | 'scores'
  | 'leaderboard'
  | 'certificates'
  | 'achievements'
  | 'profile'
  | 'notifications';

const TABS: { id: MemberTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'tests', label: 'Coding Tests', icon: ListChecks },
  { id: 'scores', label: 'Test Scores', icon: Timer },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'certificates', label: 'Certificates', icon: FileBadge },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export const MemberDashboard: React.FC<MemberDashboardProps> = ({
  currentUser,
  events,
  notifications,
  onOpenAuth,
  onSelectRegistration,
  onBrowseEvents,
}) => {
  const [activeTab, setActiveTab] = useState<MemberTab>('overview');
  const [registrations, setRegistrations] = useState<StudentRegistration[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      api.getMyRegistrations()
        .then(setRegistrations)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
          <Ticket className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="text-2xl font-extrabold text-white">Sign In to View Your Dashboard</h3>
        <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
          Access your registered events, coding tests, scores, leaderboard rank, certificates, and achievements.
        </p>
        <button
          onClick={onOpenAuth}
          className="mt-6 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-indigo-500 transition-all"
        >
          Sign In / Student Login
        </button>
      </div>
    );
  }

  const upcomingWorkshops = events.filter((e) => e.category === 'workshop');

  return (
    <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Member Profile Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-extrabold text-2xl font-mono">
            {currentUser.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">{currentUser.fullName}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Member Dashboard
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400 font-mono">
              <span>{currentUser.email}</span>
              {currentUser.rollNumber && (
                <>
                  <span>•</span>
                  <span className="text-amber-300 font-bold">Roll: {currentUser.rollNumber}</span>
                </>
              )}
              {currentUser.year && (
                <>
                  <span>•</span>
                  <span>
                    {currentUser.year} ({currentUser.section})
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onBrowseEvents}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Register for More Events</span>
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          registrations={registrations}
          loading={loading}
          upcomingWorkshops={upcomingWorkshops}
          onSelectRegistration={onSelectRegistration}
          onBrowseEvents={onBrowseEvents}
        />
      )}
      {activeTab === 'tests' && <CodingTestsTab />}
      {activeTab === 'scores' && <TestScoresTab />}
      {activeTab === 'leaderboard' && <LeaderboardTab currentUser={currentUser} />}
      {activeTab === 'certificates' && <CertificatesTab />}
      {activeTab === 'achievements' && <AchievementsTab />}
      {activeTab === 'profile' && <ProfileTab currentUser={currentUser} />}
      {activeTab === 'notifications' && <NotificationsTab notifications={notifications} />}
    </div>
  );
};

// --- Overview: Registered Events + Upcoming Workshops ---
const OverviewTab: React.FC<{
  registrations: StudentRegistration[];
  loading: boolean;
  upcomingWorkshops: EventItem[];
  onSelectRegistration: (reg: StudentRegistration) => void;
  onBrowseEvents: () => void;
}> = ({ registrations, loading, upcomingWorkshops, onSelectRegistration, onBrowseEvents }) => (
  <div className="space-y-10">
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Ticket className="w-5 h-5 text-cyan-400" />
        <span>My Registered Events ({registrations.length})</span>
      </h3>

      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Loading your registrations…</div>
      ) : registrations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {registrations.map((reg) => (
            <div
              key={reg.id}
              className="relative rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between gap-3 border-b border-dashed border-slate-800 pb-4 mb-4">
                  <div>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">Digital Entry Pass</span>
                    <h4 className="text-base font-bold text-white mt-0.5">{reg.eventTitle}</h4>
                  </div>
                  <div className="p-2 rounded-xl bg-white text-slate-900 shrink-0">
                    <QrCode className="w-10 h-10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">REGISTRATION ID</span>
                    <span className="text-sm font-mono font-bold text-cyan-300">{reg.registrationId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">ATTENDANCE STATUS</span>
                    <span className={reg.attended ? 'text-emerald-400 font-bold' : 'text-amber-400 font-medium'}>
                      {reg.attended ? 'Checked In ✓' : 'Confirmed (Pending Event)'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectRegistration(reg)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>View Pass & Share</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Print Pass"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800">
          <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-white">No registrations found yet</h4>
          <button
            onClick={onBrowseEvents}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors"
          >
            Browse Technical Events
          </button>
        </div>
      )}
    </div>

    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-cyan-400" />
        <span>Upcoming Workshops ({upcomingWorkshops.length})</span>
      </h3>
      {upcomingWorkshops.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingWorkshops.map((ev) => (
            <div key={ev.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <h4 className="text-sm font-bold text-white">{ev.title}</h4>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>{ev.dates}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>{ev.venue}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No workshops scheduled right now. Check back soon.</p>
      )}
    </div>
  </div>
);

// --- Coding Tests ---
const CodingTestsTab: React.FC = () => {
  const [tests, setTests] = useState<CodingTestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTest, setActiveTest] = useState<CodingTestDetail | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; totalMarks: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getMyTests().then(setTests).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startTest = async (testId: string) => {
    setError(null);
    setResult(null);
    try {
      const detail = await api.getTestToAttempt(testId);
      setActiveTest(detail);
      setAnswers(new Array(detail.questions.length).fill(-1));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const submit = async () => {
    if (!activeTest) return;
    setSubmitting(true);
    try {
      const res = await api.submitTest(activeTest.id, answers);
      setResult({ score: res.score, totalMarks: res.totalMarks });
      setActiveTest(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (activeTest) {
    return (
      <div className="space-y-5 max-w-3xl">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <h3 className="text-base font-bold text-white">{activeTest.title}</h3>
          <p className="text-xs text-slate-400 mt-1">{activeTest.description}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-amber-300 font-mono">
            <Timer className="w-3.5 h-3.5" />
            <span>{activeTest.durationMinutes} minutes • {activeTest.totalMarks} marks</span>
          </div>
        </div>

        {activeTest.questions.map((q, qi) => (
          <div key={q.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <p className="text-sm font-semibold text-white mb-3">
              {qi + 1}. {q.question} <span className="text-[10px] text-slate-500 font-mono">({q.marks} marks)</span>
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-colors ${
                    answers[qi] === oi
                      ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() => {
                      const next = [...answers];
                      next[qi] = oi;
                      setAnswers(next);
                    }}
                    className="accent-cyan-500"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={submitting || answers.includes(-1)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Submit Test</span>
          </button>
          <button
            onClick={() => setActiveTest(null)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>Test submitted! You scored {result.score} / {result.totalMarks}.</span>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">{error}</div>}
      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Loading coding tests…</div>
      ) : tests.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800">
          <ListChecks className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-white">No coding tests published yet</h4>
          <p className="text-xs text-slate-400 mt-1">Check back once the admin publishes a test.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tests.map((t) => (
            <div key={t.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">{t.title}</h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.description}</p>
                <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{t.durationMinutes}m</span>
                  <span>•</span>
                  <span>{t.questionCount} questions</span>
                  <span>•</span>
                  <span>{t.totalMarks} marks</span>
                </div>
              </div>
              <button
                onClick={() => startTest(t.id)}
                disabled={t.hasAttempted}
                className="mt-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {t.hasAttempted ? <span>Already Attempted</span> : (
                  <>
                    <span>Start Test</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Test Scores ---
const TestScoresTab: React.FC = () => {
  const [scores, setScores] = useState<TestScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyTestScores().then(setScores).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading scores…</div>;

  if (scores.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800">
        <Timer className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-white">No test scores yet</h4>
        <p className="text-xs text-slate-400 mt-1">Attempt a coding test to see your scores here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-800/60 text-slate-400 font-mono uppercase">
          <tr>
            <th className="text-left px-4 py-3">Test</th>
            <th className="text-left px-4 py-3">Score</th>
            <th className="text-left px-4 py-3">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {scores.map((s) => (
            <tr key={s.testId}>
              <td className="px-4 py-3 text-white font-semibold">{s.testTitle}</td>
              <td className="px-4 py-3 text-cyan-300 font-mono font-bold">{s.score} / {s.totalMarks}</td>
              <td className="px-4 py-3 text-slate-400 font-mono">{new Date(s.submittedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Leaderboard ---
const LeaderboardTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeaderboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading leaderboard…</div>;

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800">
        <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-white">Leaderboard is empty</h4>
        <p className="text-xs text-slate-400 mt-1">Scores will appear here once members start taking coding tests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.myRank && (
        <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
            <Medal className="w-5 h-5" />
            <span>Your Rank: #{data.myRank.rank}</span>
          </div>
          <span className="text-xs font-mono text-slate-300">
            {data.myRank.totalScore} pts • {data.myRank.testsTaken} test(s)
          </span>
        </div>
      )}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60 text-slate-400 font-mono uppercase">
            <tr>
              <th className="text-left px-4 py-3">Rank</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Roll No.</th>
              <th className="text-left px-4 py-3">Score</th>
              <th className="text-left px-4 py-3">Tests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.leaderboard.map((row) => (
              <tr key={row.rank} className={row.fullName === currentUser.fullName ? 'bg-cyan-950/20' : ''}>
                <td className="px-4 py-3 font-mono font-bold text-amber-300">
                  {row.rank <= 3 ? <Star className="w-3.5 h-3.5 inline mr-1" /> : null}#{row.rank}
                </td>
                <td className="px-4 py-3 text-white font-semibold">{row.fullName}</td>
                <td className="px-4 py-3 text-slate-400 font-mono">{row.rollNumber || '—'}</td>
                <td className="px-4 py-3 text-cyan-300 font-mono font-bold">{row.totalScore}</td>
                <td className="px-4 py-3 text-slate-400">{row.testsTaken}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Certificates (auto-download via canvas composite) ---
const CertificateCard: React.FC<{ cert: MyCertificate; fullName: string }> = ({ cert, fullName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!cert.template) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      ctx.font = `bold ${cert.template!.fontSize}px "${cert.template!.fontFamily}", sans-serif`;
      ctx.fillStyle = cert.template!.fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const x = (cert.template!.nameX / 100) * canvas.width;
      const y = (cert.template!.nameY / 100) * canvas.height;
      ctx.fillText(fullName, x, y);
      setReady(true);
    };
    img.src = cert.template.imageData;
  }, [cert, fullName]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${cert.template?.name || 'certificate'}-${fullName.replace(/\s+/g, '_')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  if (!cert.template) return null;

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
      <canvas ref={canvasRef} className="w-full rounded-xl border border-slate-800" />
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">{cert.template.name}</h4>
          <p className="text-[11px] text-slate-400 font-mono">
            Approved {new Date(cert.approvedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={download}
          disabled={!ready}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
};

const CertificatesTab: React.FC = () => {
  const [certs, setCerts] = useState<MyCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = React.useMemo(() => JSON.parse(localStorage.getItem('synapse_user_data') || 'null'), []);

  useEffect(() => {
    api.getMyCertificates().then(setCerts).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading certificates…</div>;

  if (certs.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800">
        <FileBadge className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-white">No certificates available yet</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Once the admin approves you for a certificate, it will appear here for instant download.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {certs.map((c) => (
        <CertificateCard key={c.id} cert={c} fullName={currentUser?.fullName || ''} />
      ))}
    </div>
  );
};

// --- Achievements ---
const AchievementsTab: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyAchievements().then(setAchievements).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-400 text-sm">Loading achievements…</div>;

  if (achievements.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800">
        <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-white">No achievements yet</h4>
        <p className="text-xs text-slate-400 mt-1">Participate in events and tests to earn achievements.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {achievements.map((a) => (
        <div key={a.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{a.title}</h4>
            <p className="text-xs text-slate-400 mt-1">{a.description}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1.5">{new Date(a.awardedAt).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Profile ---
const ProfileTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [year, setYear] = useState(currentUser.year || '1st Year');
  const [section, setSection] = useState(currentUser.section || 'A');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateProfile({ fullName, year, section });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <label className="block text-xs font-mono font-semibold uppercase text-slate-400 mb-1.5">Full Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-semibold uppercase text-slate-400 mb-1.5">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono font-semibold uppercase text-slate-400 mb-1.5">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              {['A', 'B', 'C', 'D', 'Other'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800">
          <p><span className="text-slate-500">Username:</span> {currentUser.username}</p>
          <p><span className="text-slate-500">Email:</span> {currentUser.email}</p>
          {currentUser.rollNumber && <p><span className="text-slate-500">Roll Number:</span> {currentUser.rollNumber}</p>}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Saved!' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
};

// --- Notifications ---
const NotificationsTab: React.FC<{ notifications: NotificationItem[] }> = ({ notifications }) => {
  const relevant = notifications.filter((n) => n.targetRole === 'all' || n.targetRole === 'students' || !n.targetRole);

  if (relevant.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-slate-800">
        <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-white">No notifications</h4>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {relevant.map((n) => (
        <div key={n.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">{n.title}</h4>
            <span className="text-[10px] font-mono text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{n.message}</p>
        </div>
      ))}
    </div>
  );
};
