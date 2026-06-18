import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BookOpen, Tag, DollarSign, FileText, Plus, X, AlertCircle,
  Youtube, ListChecks, Trash2, GripVertical, CheckCircle2, ChevronUp, ChevronDown,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';

// ---------- Types ----------

interface CourseFormData {
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  price: string;
  thumbnailUrl: string;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
}

interface LessonDraft {
  key: string; // local key for React list
  title: string;
  videoUrl: string;
  isFree: boolean;
}

type QuestionType = 'single_choice' | 'true_false' | 'multiple_choice';

interface OptionDraft {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  key: string;
  text: string;
  type: QuestionType;
  options: OptionDraft[];
}

interface QuizDraft {
  key: string;
  title: string;
  passingScore: string; // kept as string for input control
  questions: QuestionDraft[];
}

// ---------- Helpers ----------

// Match the common YouTube URL shapes a creator might paste. We keep the user's
// exact URL when posting to the API (Lesson.videoUrl is just a string), but use
// this for inline validation feedback.
const YOUTUBE_RE =
  /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/;

function isValidYouTubeUrl(url: string): boolean {
  if (!url) return false;
  return YOUTUBE_RE.test(url.trim());
}

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

function makeBlankOption(): OptionDraft {
  return { id: newKey(), text: '', isCorrect: false };
}

function makeBlankQuestion(): QuestionDraft {
  return {
    key: newKey(),
    text: '',
    type: 'single_choice',
    options: [makeBlankOption(), makeBlankOption()],
  };
}

function makeBlankLesson(): LessonDraft {
  return { key: newKey(), title: '', videoUrl: '', isFree: false };
}

function makeBlankQuiz(): QuizDraft {
  return {
    key: newKey(),
    title: '',
    passingScore: '60',
    questions: [makeBlankQuestion()],
  };
}

// ---------- Component ----------

export default function CreateCourse() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: Category[] }>('/api/categories')
      .then((res) => {
        if (res.success && res.data) setCategories(res.data);
      })
      .catch(() => {})
      .finally(() => setCategoriesLoading(false));
  }, []);

  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    slug: '',
    description: '',
    categoryId: '',
    price: '0',
    thumbnailUrl: '',
    tags: [],
  });

  const [lessons, setLessons] = useState<LessonDraft[]>([]);
  const [quizzes, setQuizzes] = useState<QuizDraft[]>([]);

  const canCreateCourse = user && ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);

  // ---- Course form helpers ----

  const handleChange = (field: keyof CourseFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'title' && (!prev.slug || prev.slug === generateSlug(prev.title))) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  // ---- Lesson helpers ----

  const addLesson = () => setLessons((prev) => [...prev, makeBlankLesson()]);

  const updateLesson = (key: string, patch: Partial<LessonDraft>) =>
    setLessons((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLesson = (key: string) =>
    setLessons((prev) => prev.filter((l) => l.key !== key));

  const moveLesson = (key: string, direction: -1 | 1) =>
    setLessons((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  // ---- Quiz helpers ----

  const addQuiz = () => setQuizzes((prev) => [...prev, makeBlankQuiz()]);

  const updateQuiz = (key: string, patch: Partial<QuizDraft>) =>
    setQuizzes((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const removeQuiz = (key: string) =>
    setQuizzes((prev) => prev.filter((q) => q.key !== key));

  const updateQuestion = (
    quizKey: string,
    qKey: string,
    patch: Partial<QuestionDraft>,
  ) =>
    setQuizzes((prev) =>
      prev.map((qz) =>
        qz.key !== quizKey
          ? qz
          : { ...qz, questions: qz.questions.map((q) => (q.key === qKey ? { ...q, ...patch } : q)) },
      ),
    );

  const addQuestion = (quizKey: string) =>
    setQuizzes((prev) =>
      prev.map((qz) => (qz.key === quizKey ? { ...qz, questions: [...qz.questions, makeBlankQuestion()] } : qz)),
    );

  const removeQuestion = (quizKey: string, qKey: string) =>
    setQuizzes((prev) =>
      prev.map((qz) =>
        qz.key !== quizKey ? qz : { ...qz, questions: qz.questions.filter((q) => q.key !== qKey) },
      ),
    );

  const setQuestionType = (quizKey: string, qKey: string, type: QuestionType) => {
    setQuizzes((prev) =>
      prev.map((qz) =>
        qz.key !== quizKey
          ? qz
          : {
              ...qz,
              questions: qz.questions.map((q) => {
                if (q.key !== qKey) return q;
                if (type === 'true_false') {
                  return {
                    ...q,
                    type,
                    options: [
                      { id: 'true', text: 'True', isCorrect: false },
                      { id: 'false', text: 'False', isCorrect: false },
                    ],
                  };
                }
                // ensure at least 2 options for choice types
                const opts = q.options.length >= 2 ? q.options : [makeBlankOption(), makeBlankOption()];
                // For single_choice: if multiple options were correct, keep only the first.
                if (type === 'single_choice') {
                  let foundCorrect = false;
                  return {
                    ...q,
                    type,
                    options: opts.map((o) => {
                      if (o.isCorrect && !foundCorrect) {
                        foundCorrect = true;
                        return o;
                      }
                      return { ...o, isCorrect: false };
                    }),
                  };
                }
                return { ...q, type, options: opts };
              }),
            },
      ),
    );
  };

  const setOptionField = (
    quizKey: string,
    qKey: string,
    optId: string,
    patch: Partial<OptionDraft>,
    radio: boolean,
  ) =>
    setQuizzes((prev) =>
      prev.map((qz) =>
        qz.key !== quizKey
          ? qz
          : {
              ...qz,
              questions: qz.questions.map((q) =>
                q.key !== qKey
                  ? q
                  : {
                      ...q,
                      options: q.options.map((o) =>
                        o.id === optId
                          ? { ...o, ...patch }
                          : radio && patch.isCorrect
                            ? { ...o, isCorrect: false }
                            : o,
                      ),
                    },
              ),
            },
      ),
    );

  const addOption = (quizKey: string, qKey: string) =>
    setQuizzes((prev) =>
      prev.map((qz) =>
        qz.key !== quizKey
          ? qz
          : {
              ...qz,
              questions: qz.questions.map((q) =>
                q.key !== qKey ? q : { ...q, options: [...q.options, makeBlankOption()] },
              ),
            },
      ),
    );

  const removeOption = (quizKey: string, qKey: string, optId: string) =>
    setQuizzes((prev) =>
      prev.map((qz) =>
        qz.key !== quizKey
          ? qz
          : {
              ...qz,
              questions: qz.questions.map((q) =>
                q.key !== qKey ? q : { ...q, options: q.options.filter((o) => o.id !== optId) },
              ),
            },
      ),
    );

  // ---- Pre-submit validation ----

  function validateExtras(): string | null {
    for (const [i, l] of lessons.entries()) {
      if (!l.title.trim()) return `Lesson #${i + 1} needs a title.`;
      if (!l.videoUrl.trim()) return `Lesson #${i + 1} needs a YouTube URL.`;
      if (!isValidYouTubeUrl(l.videoUrl)) return `Lesson #${i + 1}: "${l.videoUrl}" doesn't look like a YouTube URL.`;
    }
    for (const [qi, qz] of quizzes.entries()) {
      if (!qz.title.trim()) return `Quiz #${qi + 1} needs a title.`;
      const ps = Number(qz.passingScore);
      if (!Number.isFinite(ps) || ps < 0 || ps > 100) return `Quiz #${qi + 1}: passing score must be 0–100.`;
      if (qz.questions.length === 0) return `Quiz #${qi + 1} needs at least one question.`;
      for (const [i, q] of qz.questions.entries()) {
        if (!q.text.trim()) return `Quiz #${qi + 1} → Question #${i + 1} needs text.`;
        if (q.options.length < 2) return `Quiz #${qi + 1} → Question #${i + 1} needs at least 2 options.`;
        if (q.options.some((o) => !o.text.trim())) return `Quiz #${qi + 1} → Question #${i + 1}: every option needs text.`;
        const correctCount = q.options.filter((o) => o.isCorrect).length;
        if (q.type === 'multiple_choice' && correctCount === 0)
          return `Quiz #${qi + 1} → Question #${i + 1}: mark at least one correct option.`;
        if (q.type !== 'multiple_choice' && correctCount !== 1)
          return `Quiz #${qi + 1} → Question #${i + 1}: pick exactly one correct option.`;
      }
    }
    return null;
  }

  // ---- Submit pipeline ----

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!canCreateCourse) {
      setError('You need to be an instructor or admin to create courses');
      return;
    }

    const extrasError = validateExtras();
    if (extrasError) {
      setError(extrasError);
      return;
    }

    setLoading(true);
    setError(null);
    setProgress('Creating course…');

    try {
      // 1. Create the course itself.
      const coursePayload = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        thumbnailUrl: formData.thumbnailUrl || undefined,
      };
      const courseRes = await apiClient.post<any>('/api/courses', coursePayload);
      if (!courseRes.success || !courseRes.data?.id) {
        throw new Error(courseRes.error || 'Failed to create course');
      }
      const courseId = courseRes.data.id as string;

      // 2. Only create a default Section if there's lesson/quiz content to attach.
      let sectionId: string | null = null;
      if (lessons.length > 0 || quizzes.length > 0) {
        setProgress('Creating default section…');
        const sectionRes = await apiClient.post<any>(`/api/courses/${courseId}/sections`, {
          title: 'Course Content',
          description: 'Lessons and quizzes for this course',
          order: 0,
        });
        if (!sectionRes.success || !sectionRes.data?.id) {
          throw new Error(sectionRes.error || 'Failed to create the default section');
        }
        sectionId = sectionRes.data.id as string;
      }

      // 3. Lessons.
      for (const [idx, l] of lessons.entries()) {
        setProgress(`Adding lesson ${idx + 1} of ${lessons.length}…`);
        const lessonRes = await apiClient.post<any>(
          `/api/courses/${courseId}/sections/${sectionId}/lessons`,
          {
            title: l.title.trim(),
            videoUrl: l.videoUrl.trim(),
            order: idx,
            isFree: l.isFree,
          },
        );
        if (!lessonRes.success) {
          throw new Error(`Lesson "${l.title}" failed: ${lessonRes.error || 'unknown error'}`);
        }
      }

      // 4. Quizzes.
      for (const [idx, qz] of quizzes.entries()) {
        setProgress(`Adding quiz ${idx + 1} of ${quizzes.length}…`);
        const quizRes = await apiClient.post<any>(`/api/quizzes/sections/${sectionId}/quiz`, {
          title: qz.title.trim(),
          passingScore: Number(qz.passingScore) || 60,
          questions: qz.questions.map((q, qi) => ({
            text: q.text.trim(),
            type: q.type,
            order: qi,
            options: q.options.map((o) => ({
              id: o.id,
              text: o.text.trim(),
              isCorrect: o.isCorrect,
            })),
          })),
        });
        if (!quizRes.success) {
          throw new Error(`Quiz "${qz.title}" failed: ${quizRes.error || 'unknown error'}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['courses'] });
      navigate(`/courses/${courseId}`);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error || err?.message || 'An error occurred while creating the course';
      setError(errorMsg);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  // ---------- Render helpers ----------

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  };
  const labelBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 8,
  };
  const sectionCard: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: 24,
    marginBottom: 24,
  };

  const renderLesson = (l: LessonDraft, idx: number) => {
    const validUrl = isValidYouTubeUrl(l.videoUrl);
    return (
      <div
        key={l.key}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 1.5fr auto auto',
          gap: 12,
          alignItems: 'center',
          padding: 12,
          marginBottom: 8,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#f9fafb',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            type="button"
            onClick={() => moveLesson(l.key, -1)}
            disabled={idx === 0}
            title="Move up"
            style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: '#6b7280', padding: 2 }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => moveLesson(l.key, 1)}
            disabled={idx === lessons.length - 1}
            title="Move down"
            style={{ background: 'none', border: 'none', cursor: idx === lessons.length - 1 ? 'not-allowed' : 'pointer', color: '#6b7280', padding: 2 }}
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <input
          type="text"
          placeholder={`Lesson ${idx + 1} title`}
          value={l.title}
          onChange={(e) => updateLesson(l.key, { title: e.target.value })}
          style={inputBase}
        />
        <div>
          <input
            type="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={l.videoUrl}
            onChange={(e) => updateLesson(l.key, { videoUrl: e.target.value })}
            style={{
              ...inputBase,
              borderColor: !l.videoUrl ? '#d1d5db' : validUrl ? '#10b981' : '#fca5a5',
            }}
          />
          {l.videoUrl && !validUrl && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626' }}>
              Not a recognized YouTube URL
            </p>
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151' }}>
          <input
            type="checkbox"
            checked={l.isFree}
            onChange={(e) => updateLesson(l.key, { isFree: e.target.checked })}
          />
          Free preview
        </label>
        <button
          type="button"
          onClick={() => removeLesson(l.key)}
          title="Remove lesson"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, display: 'flex' }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const renderQuestion = (quizKey: string, q: QuestionDraft, qi: number, totalQ: number) => (
    <div
      key={q.key}
      style={{
        padding: 12,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#f9fafb',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Question {qi + 1}</span>
        <select
          value={q.type}
          onChange={(e) => setQuestionType(quizKey, q.key, e.target.value as QuestionType)}
          style={{
            padding: '6px 8px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            background: '#fff',
          }}
        >
          <option value="single_choice">Single choice</option>
          <option value="multiple_choice">Multiple choice</option>
          <option value="true_false">True / False</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => removeQuestion(quizKey, q.key)}
          disabled={totalQ === 1}
          title={totalQ === 1 ? 'A quiz needs at least one question' : 'Remove question'}
          style={{
            background: 'none', border: 'none',
            cursor: totalQ === 1 ? 'not-allowed' : 'pointer',
            color: totalQ === 1 ? '#9ca3af' : '#dc2626',
            padding: 4, display: 'flex',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <input
        type="text"
        placeholder="Question text"
        value={q.text}
        onChange={(e) => updateQuestion(quizKey, q.key, { text: e.target.value })}
        style={{ ...inputBase, marginBottom: 8 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {q.options.map((o) => {
          const radio = q.type !== 'multiple_choice';
          const disableEdit = q.type === 'true_false';
          return (
            <div
              key={o.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <label
                title="Mark as correct"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: o.isCorrect ? '#10b981' : '#6b7280',
                  fontWeight: o.isCorrect ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                <input
                  type={radio ? 'radio' : 'checkbox'}
                  name={`q-${q.key}-correct`}
                  checked={o.isCorrect}
                  onChange={(e) =>
                    setOptionField(quizKey, q.key, o.id, { isCorrect: e.target.checked }, radio)
                  }
                />
                <CheckCircle2 size={14} />
              </label>
              <input
                type="text"
                placeholder={`Option`}
                value={o.text}
                onChange={(e) => setOptionField(quizKey, q.key, o.id, { text: e.target.value }, false)}
                disabled={disableEdit}
                style={{
                  ...inputBase,
                  padding: '8px 10px',
                  background: disableEdit ? '#f3f4f6' : '#fff',
                  color: disableEdit ? '#6b7280' : '#111827',
                }}
              />
              <button
                type="button"
                onClick={() => removeOption(quizKey, q.key, o.id)}
                disabled={q.type === 'true_false' || q.options.length <= 2}
                title="Remove option"
                style={{
                  background: 'none', border: 'none',
                  cursor: q.type === 'true_false' || q.options.length <= 2 ? 'not-allowed' : 'pointer',
                  color: q.type === 'true_false' || q.options.length <= 2 ? '#9ca3af' : '#dc2626',
                  padding: 4, display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
        {q.type !== 'true_false' && (
          <button
            type="button"
            onClick={() => addOption(quizKey, q.key)}
            style={{
              alignSelf: 'flex-start',
              marginTop: 4,
              padding: '6px 10px',
              background: '#fff',
              border: '1px dashed #d1d5db',
              borderRadius: 6,
              color: '#10b981',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={12} /> Add option
          </button>
        )}
      </div>
    </div>
  );

  const renderQuiz = (qz: QuizDraft, idx: number) => (
    <div
      key={qz.key}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Quiz {idx + 1}</span>
        <input
          type="text"
          placeholder="Quiz title"
          value={qz.title}
          onChange={(e) => updateQuiz(qz.key, { title: e.target.value })}
          style={{ ...inputBase, flex: 2 }}
        />
        <input
          type="number"
          min={0}
          max={100}
          placeholder="Pass %"
          value={qz.passingScore}
          onChange={(e) => updateQuiz(qz.key, { passingScore: e.target.value })}
          title="Passing score (%)"
          style={{ ...inputBase, flex: 0.6 }}
        />
        <button
          type="button"
          onClick={() => removeQuiz(qz.key)}
          title="Remove quiz"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, display: 'flex' }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {qz.questions.map((q, qi) => renderQuestion(qz.key, q, qi, qz.questions.length))}

      <button
        type="button"
        onClick={() => addQuestion(qz.key)}
        style={{
          marginTop: 4,
          padding: '8px 12px',
          background: '#10b981',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Plus size={14} /> Add question
      </button>
    </div>
  );

  // ---------- JSX ----------

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate('/courses')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 16, padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          Back to Courses
        </button>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#111827' }}>Create New Course</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>
          Fill in the details below, then add lessons and quizzes that ship with the course.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12,
            marginBottom: 24, color: '#dc2626', fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {progress && !error && (
        <div
          style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12,
            marginBottom: 24, color: '#065f46', fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <CheckCircle2 size={16} />
          {progress}
        </div>
      )}

      {!canCreateCourse && user && (
        <div
          style={{
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 12,
            marginBottom: 24, color: '#b45309', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <strong>Insufficient Permissions</strong>
          </div>
          <p style={{ margin: 0 }}>
            You need to be an <strong>Instructor</strong> or <strong>Admin</strong> to create courses.
          </p>
          <p style={{ margin: 0 }}>Current role: <strong>{user.role}</strong></p>
        </div>
      )}
      {!canCreateCourse && !user && (
        <div
          style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12,
            marginBottom: 24, color: '#dc2626', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <AlertCircle size={16} />
          You need to be logged in to create courses.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* --- Course basics --- */}
        <div style={sectionCard}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><BookOpen size={16} />Course Title *</label>
            <input
              type="text" required value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g., Introduction to React Development"
              style={inputBase}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><Tag size={16} />URL Slug *</label>
            <input
              type="text" required value={formData.slug}
              onChange={(e) => handleChange('slug', e.target.value)}
              placeholder="e.g., intro-to-react"
              style={{ ...inputBase, fontFamily: 'monospace' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
              Auto-generated from title, but you can customize it
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><FileText size={16} />Description *</label>
            <textarea
              required value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what students will learn in this course…"
              rows={5}
              style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><Tag size={16} />Category *</label>
            <select
              required value={formData.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              disabled={categoriesLoading}
              style={{ ...inputBase, background: '#fff', cursor: categoriesLoading ? 'not-allowed' : 'pointer' }}
            >
              <option value="">{categoriesLoading ? 'Loading categories…' : 'Select a category'}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><DollarSign size={16} />Price (USD)</label>
            <input
              type="number" min="0" step="0.01" value={formData.price}
              onChange={(e) => handleChange('price', e.target.value)}
              placeholder="0.00" style={inputBase}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Set to 0 for free courses</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><BookOpen size={16} />Thumbnail URL</label>
            <input
              type="url" value={formData.thumbnailUrl}
              onChange={(e) => handleChange('thumbnailUrl', e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={inputBase}
            />
          </div>

          <div>
            <label style={labelBase}><Tag size={16} />Tags</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add a tag (press Enter)" style={{ ...inputBase, flex: 1 }}
              />
              <button
                type="button" onClick={addTag}
                style={{
                  padding: '10px 16px', background: '#10b981', color: '#fff', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={16} /> Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#f3f4f6', padding: '6px 12px', borderRadius: 16,
                      fontSize: 13, color: '#374151',
                    }}
                  >
                    {tag}
                    <button
                      type="button" onClick={() => removeTag(tag)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#6b7280' }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- Lessons --- */}
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Youtube size={18} color="#dc2626" /> Lessons
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                Paste a YouTube URL for each lesson video. Lessons land in a "Course Content" section.
              </p>
            </div>
            <button
              type="button" onClick={addLesson}
              style={{
                padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} /> Add lesson
            </button>
          </div>

          {lessons.length === 0 ? (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
              No lessons yet. You can also add them later from the course detail page.
            </p>
          ) : (
            lessons.map(renderLesson)
          )}
        </div>

        {/* --- Quizzes --- */}
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ListChecks size={18} color="#10b981" /> Quizzes
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                Add one or more quizzes. Each quiz can have single-choice, multiple-choice, or true/false questions.
              </p>
            </div>
            <button
              type="button" onClick={addQuiz}
              style={{
                padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} /> Add quiz
            </button>
          </div>

          {quizzes.length === 0 ? (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
              No quizzes yet. Quizzes are optional — you can add them later too.
            </p>
          ) : (
            quizzes.map(renderQuiz)
          )}
        </div>

        {/* --- Actions --- */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button" onClick={() => navigate('/courses')} disabled={loading}
            style={{
              padding: '12px 24px', background: '#fff', color: '#374151',
              border: '1px solid #d1d5db', borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit" disabled={loading || !canCreateCourse}
            style={{
              padding: '12px 24px',
              background: loading || !canCreateCourse ? '#d1d5db' : '#10b981',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: loading || !canCreateCourse ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600,
              opacity: loading || !canCreateCourse ? 0.6 : 1,
            }}
          >
            {loading ? (progress || 'Creating…') : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
}
