import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Tag, DollarSign, FileText, Plus, X, AlertCircle } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';

interface CourseFormData {
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  price: string;
  thumbnailUrl: string;
  tags: string[];
}

const MOCK_CATEGORIES = [
  { id: crypto.randomUUID(), name: 'Web Development', slug: 'web-dev' },
  { id: crypto.randomUUID(), name: 'Data Science', slug: 'data-science' },
  { id: crypto.randomUUID(), name: 'Mobile Development', slug: 'mobile' },
  { id: crypto.randomUUID(), name: 'Design', slug: 'design' },
  { id: crypto.randomUUID(), name: 'Business', slug: 'business' },
];

export default function CreateCourse() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  
  const [formData, setFormData] = useState<CourseFormData>({
    title: '',
    slug: '',
    description: '',
    categoryId: '',
    price: '0',
    thumbnailUrl: '',
    tags: [],
  });

  // Check if user has permission to create courses
  const canCreateCourse = user && ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!canCreateCourse) {
      setError('You need to be an instructor or admin to create courses');
      return;
    }
    
    setLoading(true);
    setError(null);

    console.log('Creating course with data:', formData);

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price) || 0,
        thumbnailUrl: formData.thumbnailUrl || undefined, // Send undefined if empty
      };

      console.log('Sending payload:', payload);

      const response = await apiClient.post('/api/courses', payload);
      
      console.log('Server response:', response);
      
      if (response.success) {
        console.log('Course created successfully, navigating to /courses');
        // Invalidate courses cache to refetch the list
        queryClient.invalidateQueries({ queryKey: ['courses'] });
        navigate('/courses');
      } else {
        setError(response.error || 'Failed to create course');
      }
    } catch (err: any) {
      console.error('Course creation error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'An error occurred while creating the course';
      setError(errorMsg);
      
      // Show validation errors if available
      if (err.response?.data?.issues) {
        const issues = err.response.data.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
        setError(`Validation error: ${issues}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CourseFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-generate slug from title if title changes and slug is empty or was auto-generated
      if (field === 'title' && (!prev.slug || prev.slug === generateSlug(prev.title))) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => navigate('/courses')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            marginBottom: 16,
            padding: 0,
          }}
        >
          <ArrowLeft size={16} />
          Back to Courses
        </button>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#111827' }}>Create New Course</h1>
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 14 }}>
          Fill in the details below to create your new course
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: 12,
            marginBottom: 24,
            color: '#dc2626',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Permission warning */}
      {!canCreateCourse && user && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
            padding: 12,
            marginBottom: 24,
            color: '#b45309',
            fontSize: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <strong>Insufficient Permissions</strong>
          </div>
          <p style={{ margin: 0 }}>
            You need to be an <strong>Instructor</strong> or <strong>Admin</strong> to create courses.
          </p>
          <p style={{ margin: 0 }}>
            Current role: <strong>{user.role}</strong>
          </p>
          <div style={{ marginTop: 4, padding: 8, background: '#fef3c7', borderRadius: 6, fontSize: 13 }}>
            <strong>Dev Mode Accounts:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              <li><code>instructor@learnloop.test</code> - Password: <code>Password123</code></li>
              <li><code>admin@learnloop.test</code> - Password: <code>Password123</code></li>
            </ul>
          </div>
        </div>
      )}
      {!canCreateCourse && !user && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: 12,
            marginBottom: 24,
            color: '#dc2626',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          You need to be logged in to create courses.
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 24,
            marginBottom: 24,
          }}
        >
          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <BookOpen size={16} />
              Course Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g., Introduction to React Development"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>

          {/* Slug */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <Tag size={16} />
              URL Slug *
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => handleChange('slug', e.target.value)}
              placeholder="e.g., intro-to-react"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
                fontFamily: 'monospace',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
              Auto-generated from title, but you can customize it
            </p>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <FileText size={16} />
              Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe what students will learn in this course..."
              rows={5}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <Tag size={16} />
              Category *
            </label>
            <select
              required
              value={formData.categoryId}
              onChange={(e) => handleChange('categoryId', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
                background: '#fff',
                cursor: 'pointer',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            >
              <option value="">Select a category</option>
              {MOCK_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <DollarSign size={16} />
              Price (USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) => handleChange('price', e.target.value)}
              placeholder="0.00"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
              Set to 0 for free courses
            </p>
          </div>

          {/* Thumbnail URL */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <BookOpen size={16} />
              Thumbnail URL
            </label>
            <input
              type="url"
              value={formData.thumbnailUrl}
              onChange={(e) => handleChange('thumbnailUrl', e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#10b981')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>

          {/* Tags */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                fontWeight: 600,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <Tag size={16} />
              Tags
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag (press Enter)"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#10b981')}
                onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
              />
              <button
                type="button"
                onClick={addTag}
                style={{
                  padding: '10px 16px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={16} />
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#f3f4f6',
                      padding: '6px 12px',
                      borderRadius: 16,
                      fontSize: 13,
                      color: '#374151',
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        color: '#6b7280',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            disabled={loading}
            style={{
              padding: '12px 24px',
              background: '#fff',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !canCreateCourse}
            style={{
              padding: '12px 24px',
              background: loading || !canCreateCourse ? '#d1d5db' : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading || !canCreateCourse ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: loading || !canCreateCourse ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </form>
    </div>
  );
}
