import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, BookOpen, Tag, DollarSign, FileText, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';

interface CourseFormData {
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  price: string;
  thumbnailUrl: string;
  level: string;
  language: string;
}

interface Category {
  id: string;
  name: string;
}

export default function EditCourse() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    slug: '',
    description: '',
    categoryId: '',
    price: '0',
    thumbnailUrl: '',
    level: 'BEGINNER',
    language: 'English',
  });

  const canEdit = user && ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);

  // Fetch existing course data
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/courses/${id}`);
      const raw = response?.data ?? response;
      return (raw?.data ?? raw) as any;
    },
    enabled: !!id,
  });

  // Fetch categories
  useEffect(() => {
    apiClient
      .get<{ success: boolean; data: Category[] }>('/api/categories')
      .then((res) => {
        if (res.success && res.data) setCategories(res.data);
      })
      .catch(() => {})
      .finally(() => setCategoriesLoading(false));
  }, []);

  // Pre-fill form when course data arrives
  useEffect(() => {
    if (course) {
      setFormData({
        title: course.title || '',
        slug: course.slug || '',
        description: course.description || '',
        categoryId: course.categoryId || course.category?.id || '',
        price: course.price != null ? String(course.price) : '0',
        thumbnailUrl: course.thumbnailUrl || '',
        level: course.level || 'BEGINNER',
        language: course.language || 'English',
      });
    }
  }, [course]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      setError('You need to be an instructor or admin to edit courses');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title: formData.title,
        slug: formData.slug,
        description: formData.description,
        categoryId: formData.categoryId,
        price: parseFloat(formData.price) || 0,
        thumbnailUrl: formData.thumbnailUrl || undefined,
        level: formData.level,
        language: formData.language,
      };

      const res = await apiClient.patch<any>(`/api/courses/${id}`, payload);
      if (res.success === false) {
        throw new Error(res.error || 'Failed to update course');
      }

      // Invalidate course queries so detail page shows updated data
      queryClient.invalidateQueries({ queryKey: ['course', id] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });

      setSuccess('Course updated successfully!');
      setTimeout(() => navigate(`/courses/${id}`), 1200);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error || err?.message || 'An error occurred while updating the course';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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

  if (courseLoading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        <p className="muted">Loading course...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate(`/courses/${id}`)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 16, padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          Back to Course
        </button>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#111827' }}>Edit Course</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>
          Update the course details below.
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
      {success && (
        <div
          style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: 12,
            marginBottom: 24, color: '#065f46', fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {!canEdit && (
        <div
          style={{
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 12,
            marginBottom: 24, color: '#b45309', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <AlertCircle size={16} />
          You need to be an Instructor or Admin to edit courses.
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><FileText size={16} />Description *</label>
            <textarea
              required value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what students will learn..."
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
              <option value="">{categoriesLoading ? 'Loading categories...' : 'Select a category'}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><Tag size={16} />Level</label>
            <select
              value={formData.level}
              onChange={(e) => handleChange('level', e.target.value)}
              style={{ ...inputBase, background: '#fff' }}
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelBase}><Tag size={16} />Language</label>
            <input
              type="text" value={formData.language}
              onChange={(e) => handleChange('language', e.target.value)}
              placeholder="English"
              style={inputBase}
            />
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

          <div>
            <label style={labelBase}><BookOpen size={16} />Thumbnail URL</label>
            <input
              type="url" value={formData.thumbnailUrl}
              onChange={(e) => handleChange('thumbnailUrl', e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={inputBase}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button" onClick={() => navigate(`/courses/${id}`)} disabled={loading}
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
            type="submit" disabled={loading || !canEdit}
            style={{
              padding: '12px 24px',
              background: loading || !canEdit ? '#d1d5db' : '#10b981',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: loading || !canEdit ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600,
              opacity: loading || !canEdit ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
