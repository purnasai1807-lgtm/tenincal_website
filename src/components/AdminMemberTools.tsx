import React, { useState, useEffect } from 'react';
import {
  ListChecks,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Award,
  FileBadge,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';
import { EventItem, AdminCodingTest, TestQuestion, AdminCertificateTemplate, AdminCertificateApproval } from '../types';
import { api } from '../services/api';

interface AdminMemberToolsProps {
  events: EventItem[];
}

type SubTab = 'tests' | 'achievements' | 'certificates';

export const AdminMemberTools: React.FC<AdminMemberToolsProps> = ({ events }) => {
  const [subTab, setSubTab] = useState<SubTab>('tests');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: 'tests', label: 'Coding Tests', icon: ListChecks },
          { id: 'achievements', label: 'Achievements', icon: Award },
          { id: 'certificates', label: 'Certificates', icon: FileBadge },
        ] as { id: SubTab; label: string; icon: React.ElementType }[]).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                subTab === t.id
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {subTab === 'tests' && <TestsManager events={events} />}
      {subTab === 'achievements' && <AchievementsManager />}
      {subTab === 'certificates' && <CertificatesManager events={events} />}
    </div>
  );
};

// --- Coding Tests Manager ---
const emptyQuestion = (): TestQuestion => ({
  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  marks: 1,
});

const TestsManager: React.FC<{ events: EventItem[] }> = ({ events }) => {
  const [tests, setTests] = useState<AdminCodingTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventId, setEventId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [questions, setQuestions] = useState<TestQuestion[]>([emptyQuestion()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.getAdminTests().then(setTests).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateQuestion = (idx: number, patch: Partial<TestQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: q.options.map((o, j) => (j === oIdx ? value : o)) } : q))
    );
  };

  const createTest = async (publish: boolean) => {
    setError(null);
    if (!title.trim() || questions.some((q) => !q.question.trim() || q.options.some((o) => !o.trim()))) {
      setError('Title and all question fields/options are required.');
      return;
    }
    setCreating(true);
    try {
      await api.createTest({ title, description, eventId: eventId || undefined, durationMinutes, questions, isPublished: publish });
      setSuccess(`Test "${title}" ${publish ? 'published' : 'saved as draft'}.`);
      setTitle('');
      setDescription('');
      setEventId('');
      setDurationMinutes(30);
      setQuestions([emptyQuestion()]);
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const togglePublish = async (test: AdminCodingTest) => {
    try {
      await api.updateTest(test.id, { isPublished: !test.isPublished });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const remove = async (test: AdminCodingTest) => {
    if (!window.confirm(`Delete test "${test.title}"? This also removes all submissions.`)) return;
    try {
      await api.deleteTest(test.id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Create Test Form */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>Create Coding Test</span>
        </h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Test title"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Not linked to an event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
          <input
            type="number"
            min={5}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            placeholder="Duration (minutes)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {questions.map((q, qi) => (
            <div key={q.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-cyan-300">Question {qi + 1}</span>
                {questions.length > 1 && (
                  <button
                    onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <input
                value={q.question}
                onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                placeholder="Question text"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={q.correctIndex === oi}
                    onChange={() => updateQuestion(qi, { correctIndex: oi })}
                    className="accent-emerald-500"
                  />
                  <input
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">Marks:</span>
                <input
                  type="number"
                  min={1}
                  value={q.marks}
                  onChange={(e) => updateQuestion(qi, { marks: Number(e.target.value) })}
                  className="w-16 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
          className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
        >
          + Add Question
        </button>

        {error && <p className="text-xs text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
        {success && <p className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{success}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => createTest(false)}
            disabled={creating}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => createTest(true)}
            disabled={creating}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Publish</span>
          </button>
        </div>
      </div>

      {/* Existing Tests List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Existing Tests ({tests.length})</h3>
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          tests.map((t) => (
            <div key={t.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white">{t.title}</h4>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {t.questions.length} questions • {t.totalMarks} marks • {t.durationMinutes}m
                </p>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded mt-1 inline-block ${t.isPublished ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                  {t.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => togglePublish(t)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title={t.isPublished ? 'Unpublish' : 'Publish'}
                >
                  {t.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => remove(t)}
                  className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Achievements Manager ---
const AchievementsManager: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const award = async () => {
    setError(null);
    if (!identifier.trim() || !title.trim()) {
      setError('Member roll number/username and achievement title are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await api.awardAchievement({ identifier, title, description });
      setSuccess(`Awarded "${title}" to ${res.awardedTo?.fullName || identifier}.`);
      setIdentifier('');
      setTitle('');
      setDescription('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Award className="w-4 h-4 text-amber-400" />
        <span>Award Achievement</span>
      </h3>
      <input
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        placeholder="Roll number, username, or email"
        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Achievement title (e.g. Hackathon Winner)"
        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
      />
      {error && <p className="text-xs text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
      {success && <p className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{success}</p>}
      <button
        onClick={award}
        disabled={submitting}
        className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        <span>Award Achievement</span>
      </button>
    </div>
  );
};

// --- Certificates Manager ---
const CertificatesManager: React.FC<{ events: EventItem[] }> = ({ events }) => {
  const [templates, setTemplates] = useState<AdminCertificateTemplate[]>([]);
  const [approvals, setApprovals] = useState<AdminCertificateApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [eventId, setEventId] = useState('');
  const [imageData, setImageData] = useState('');
  const [nameX, setNameX] = useState(50);
  const [nameY, setNameY] = useState(50);
  const [fontSize, setFontSize] = useState(42);
  const [fontColor, setFontColor] = useState('#1e293b');
  const [fontFamily, setFontFamily] = useState('Arial');
  const [uniqueIdEnabled, setUniqueIdEnabled] = useState(true);
  const [uniqueIdX, setUniqueIdX] = useState(50);
  const [uniqueIdY, setUniqueIdY] = useState(58);
  const [uniqueIdFontSize, setUniqueIdFontSize] = useState(14);
  const [uniqueIdFontColor, setUniqueIdFontColor] = useState('#1e293b');
  const [uniqueIdFontFamily, setUniqueIdFontFamily] = useState('Arial');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [approveIdentifier, setApproveIdentifier] = useState('');
  const [approveTemplateId, setApproveTemplateId] = useState('');
  const [approving, setApproving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ user: { fullName: string; username: string; rollNumber?: string }; uniqueId: string; template: AdminCertificateTemplate } | null>(null);
  const [certificateVerified, setCertificateVerified] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.getAdminCertificateTemplates(), api.getAdminCertificateApprovals()])
      .then(([t, a]) => {
        setTemplates(t);
        setApprovals(a);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadTemplate = async () => {
    setError(null);
    if (!name.trim() || !imageData) {
      setError('Template name and an image file are required.');
      return;
    }
    setUploading(true);
    try {
      await api.createCertificateTemplate({ name, eventId: eventId || undefined, imageData, nameX, nameY, fontSize, fontColor, fontFamily, uniqueIdEnabled, uniqueIdX, uniqueIdY, uniqueIdFontSize, uniqueIdFontColor, uniqueIdFontFamily });
      setSuccess(`Template "${name}" uploaded.`);
      setName('');
      setImageData('');
      load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeTemplate = async (id: string) => {
    if (!window.confirm('Delete this certificate template?')) return;
    await api.deleteCertificateTemplate(id);
    load();
  };

  const previewCertificate = async () => {
    setError(null); setPreview(null); setCertificateVerified(false);
    if (!approveIdentifier.trim() || !approveTemplateId) { setError('Select a template and identifier before previewing.'); return; }
    setPreviewing(true);
    try { setPreview(await api.previewCertificate(approveIdentifier.trim(), approveTemplateId)); } catch (e: any) { setError(e.message); } finally { setPreviewing(false); }
  };

  const approve = async () => {
    setError(null);
    if (!preview || !certificateVerified) { setError('Preview the certificate and verify the name and unique ID before approving.'); return; }
    setApproving(true);
    try {
      const res: any = await api.approveCertificate({ identifier: approveIdentifier, templateId: approveTemplateId, eventId: preview.template.eventId, verifiedUniqueId: preview.uniqueId });
      setSuccess(`Certificate approved for ${res.approvedFor?.fullName || approveIdentifier}. Unique ID: ${preview.uniqueId}`);
      setApproveIdentifier(''); setPreview(null); setCertificateVerified(false); load(); setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) { setError(e.message); } finally { setApproving(false); }
  };

  const revokeApproval = async (id: string) => {
    if (!window.confirm('Revoke this certificate approval?')) return;
    await api.revokeCertificateApproval(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Template */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Post Certificate Template</span>
          </h3>
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <p className="text-xs font-bold text-amber-300">Registration Unique ID</p>
            <p className="text-[11px] leading-relaxed text-slate-300">
              This is the unique event registration ID created when the member registers. It is printed automatically on approved certificates and cannot be replaced with a manually typed ID.
            </p>
            <label className="flex items-center gap-2 text-xs font-semibold text-white">
              <input type="checkbox" checked={uniqueIdEnabled} onChange={(e) => setUniqueIdEnabled(e.target.checked)} className="accent-amber-500" />
              Show registration unique ID on certificate
            </label>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name (e.g. Workshop Completion)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Not linked to an event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="w-full text-xs text-slate-300"
          />
          {imageData && (
            <div className="relative rounded-xl overflow-hidden border border-slate-700">
              <img src={imageData} alt="Template preview" className="w-full" />
              <div
                className="absolute font-bold"
                style={{
                  left: `${nameX}%`,
                  top: `${nameY}%`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: `${fontSize / 3}px`,
                  color: fontColor,
                  fontFamily,
                }}
              >
                Member Full Name
              </div>
              {uniqueIdEnabled && (
                <div className="absolute font-semibold" style={{ left: `${uniqueIdX}%`, top: `${uniqueIdY}%`, transform: 'translate(-50%, -50%)', fontSize: `${uniqueIdFontSize / 3}px`, color: uniqueIdFontColor, fontFamily: uniqueIdFontFamily }}>
                  Unique ID: REGISTRATION-ID
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[10px] text-slate-400 font-mono">
              Name X% <input type="number" value={nameX} onChange={(e) => setNameX(Number(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
            </label>
            <label className="text-[10px] text-slate-400 font-mono">
              Name Y% <input type="number" value={nameY} onChange={(e) => setNameY(Number(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
            </label>
            <label className="text-[10px] text-slate-400 font-mono">
              Font Size (px) <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" />
            </label>            <label className="text-[10px] text-slate-400 font-mono">
              Font Style
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select>
            </label>
            <label className="text-[10px] text-slate-400 font-mono">
              Font Color <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} className="w-full mt-1 h-8 rounded-lg bg-slate-800 border border-slate-700" />
            </label>
            {uniqueIdEnabled && (
              <>
                <label className="text-[10px] text-slate-400 font-mono">Unique ID X% <input type="number" min={0} max={100} value={uniqueIdX} onChange={(e) => setUniqueIdX(Number(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" /></label>
                <label className="text-[10px] text-slate-400 font-mono">Unique ID Y% <input type="number" min={0} max={100} value={uniqueIdY} onChange={(e) => setUniqueIdY(Number(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" /></label>
                <label className="text-[10px] text-slate-400 font-mono">Unique ID Size <input type="number" min={6} value={uniqueIdFontSize} onChange={(e) => setUniqueIdFontSize(Number(e.target.value))} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white" /></label>
                <label className="text-[10px] text-slate-400 font-mono">Unique ID Style <select value={uniqueIdFontFamily} onChange={(e) => setUniqueIdFontFamily(e.target.value)} className="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option></select></label>
                <label className="text-[10px] text-slate-400 font-mono">Unique ID Color <input type="color" value={uniqueIdFontColor} onChange={(e) => setUniqueIdFontColor(e.target.value)} className="w-full mt-1 h-8 rounded-lg bg-slate-800 border border-slate-700" /></label>
              </>
            )}
          </div>
          {error && <p className="text-xs text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
          {success && <p className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />{success}</p>}
          <button
            onClick={uploadTemplate}
            disabled={uploading}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Post Template</span>
          </button>
        </div>

        {/* Approve Member */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Approve Member for Certificate</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Once approved, the certificate is generated and ready for automatic download in the member's dashboard — no further action needed.
          </p>
          <select
            value={approveTemplateId}
            onChange={(e) => { setApproveTemplateId(e.target.value); setPreview(null); setCertificateVerified(false); }}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">-- Select Certificate Template --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            value={approveIdentifier}
            onChange={(e) => { setApproveIdentifier(e.target.value); setPreview(null); setCertificateVerified(false); }}
            placeholder="Roll number, username, or email"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={previewCertificate}
            disabled={previewing}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-cyan-200 bg-cyan-950/60 border border-cyan-500/40 disabled:opacity-50"
          >
            {previewing ? 'Checking registration...' : 'Preview & Verify Certificate'}
          </button>
          {preview && (
            <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3">
              <p className="text-xs font-bold text-emerald-300">Certificate verification preview</p>
              <div className="relative overflow-hidden rounded-lg border border-slate-700">
                <img src={preview.template.imageData} alt="Certificate preview" className="w-full" />
                <div
                  className="absolute text-center font-bold"
                  style={{ left: `${preview.template.nameX}%`, top: `${preview.template.nameY}%`, transform: 'translate(-50%, -50%)', color: preview.template.fontColor, fontFamily: preview.template.fontFamily, fontSize: Math.max(10, preview.template.fontSize / 3) }}
                >
                  {preview.user.fullName}
                </div>
                {preview.template.uniqueIdEnabled !== false && <div className="absolute text-center font-semibold" style={{ left: `${preview.template.uniqueIdX ?? preview.template.nameX}%`, top: `${preview.template.uniqueIdY ?? preview.template.nameY + 8}%`, transform: 'translate(-50%, -50%)', color: preview.template.uniqueIdFontColor ?? preview.template.fontColor, fontFamily: preview.template.uniqueIdFontFamily ?? preview.template.fontFamily, fontSize: Math.max(8, (preview.template.uniqueIdFontSize ?? preview.template.fontSize * 0.32) / 3) }}>Unique ID: {preview.uniqueId}</div>}
              </div>
              <p className="text-[11px] text-slate-300">
                Member: <b>{preview.user.fullName}</b> · Unique ID: <b className="text-amber-300">{preview.uniqueId}</b>
              </p>
              <label className="flex items-start gap-2 text-[11px] text-slate-300">
                <input type="checkbox" checked={certificateVerified} onChange={(e) => setCertificateVerified(e.target.checked)} className="mt-0.5 accent-emerald-500" />
                I verified that this member, certificate, and unique ID are correct.
              </label>
            </div>
          )}

          <button
            onClick={approve}
            disabled={approving || !preview || !certificateVerified}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {approving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Approve Certificate</span>
          </button>

          <div className="pt-3 border-t border-slate-800 space-y-2 max-h-64 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-300">Recent Approvals ({approvals.length})</h4>
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs">
                <div>
                  <span className="text-white font-semibold">{a.fullName || a.userId}</span>
                  <span className="text-slate-500 font-mono ml-2">{a.rollNumber}</span>
                </div>
                <button onClick={() => revokeApproval(a.id)} className="text-rose-400 hover:text-rose-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">Certificate Templates ({templates.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
                <img src={t.imageData} alt={t.name} className="w-full h-32 object-cover" />
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{t.name}</span>
                  <button onClick={() => removeTemplate(t.id)} className="text-rose-400 hover:text-rose-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
