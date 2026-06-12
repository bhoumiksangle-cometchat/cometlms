import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  GraduationCap,
  Plus
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuth } from '../auth/useAuth';

export function CourseList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  const isInstructor = user?.role === 'INSTRUCTOR';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isStaff = isInstructor || isAdmin;

  const {
    data: courses = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const response = await apiClient.get('/api/courses');
      const raw = response?.data ?? response;
      return Array.isArray(raw) ? raw : raw?.data ?? [];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c: any) => c.category?.name).filter(Boolean))).sort() as string[],
    [courses]
  );
  const levels = useMemo(
    () => Array.from(new Set(courses.map((c: any) => c.level).filter(Boolean))).sort() as string[],
    [courses]
  );

  const visibleCourses = useMemo(() => {
    let result: any[] = [...courses];

    if (activeTab === 'my' && isStaff) {
      result = result.filter((c) => c.instructor?.id === user?.id);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.instructor?.name.toLowerCase().includes(q)
      );
    }

    if (selectedLevel) result = result.filter((c) => c.level === selectedLevel);
    if (selectedCategory) result = result.filter((c) => c.category?.name === selectedCategory);

    return result;
  }, [courses, searchQuery, selectedLevel, selectedCategory, activeTab, isStaff, user]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLevel('');
    setSelectedCategory('');
  };

  if (isLoading) {
    return (
      <section className="panel">
        <p className="muted">Loading courses...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel accent-panel" style={{ borderColor: '#fca5a5', backgroundColor: '#fef2f2' }}>
        <h2 style={{ color: '#991b1b', margin: '0 0 10px' }}>Failed to load courses</h2>
        <p className="muted">Please check your backend connection.</p>
      </section>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Search & Filters Panel */}
      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <GraduationCap aria-hidden />
            <h2>{isStaff ? 'Course Catalogue' : 'Explore Courses'}</h2>
          </div>
          {isStaff && (
            <button className="wide-button" style={{ width: 'auto', marginTop: 0, padding: '0 16px' }} onClick={() => navigate('/courses/create')}>
              <Plus size={16} /> New Course
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="search" style={{ flex: 1, minWidth: '240px' }}>
            <Search aria-hidden />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '0 12px', border: '1px solid #cbd7d2', borderRadius: '8px', background: '#fff', minHeight: '42px' }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select 
            value={selectedLevel} 
            onChange={(e) => setSelectedLevel(e.target.value)}
            style={{ padding: '0 12px', border: '1px solid #cbd7d2', borderRadius: '8px', background: '#fff', minHeight: '42px' }}
          >
            <option value="">All Levels</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {(searchQuery || selectedLevel || selectedCategory) && (
            <button className="icon-button" onClick={clearFilters} title="Clear filters">
              ✕
            </button>
          )}
        </div>

        {isStaff && (
          <div className="tabs" role="tablist" style={{ marginTop: '16px', marginBottom: 0 }}>
            <button className={activeTab === 'all' ? 'selected' : ''} onClick={() => setActiveTab('all')}>All Courses</button>
            <button className={activeTab === 'my' ? 'selected' : ''} onClick={() => setActiveTab('my')}>My Courses</button>
          </div>
        )}
      </section>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {visibleCourses.length === 0 ? (
          <section className="panel" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
            <p className="muted" style={{ padding: '40px 0' }}>No courses found matching your criteria.</p>
          </section>
        ) : (
          visibleCourses.map((course) => (
            <article 
              key={course.id} 
              className="panel" 
              style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', padding: 0, overflow: 'hidden' }}
              onClick={() => navigate(`/courses/${course.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ height: '140px', background: 'linear-gradient(135deg, #24675d 0%, #16322f 100%)', position: 'relative' }}>
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
                    <GraduationCap size={48} />
                  </div>
                )}
                <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px' }}>
                  <span style={{ background: '#fff', color: '#24675d', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                    {course.level}
                  </span>
                  {course.price === 0 && (
                    <span style={{ background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                      Free
                    </span>
                  )}
                </div>
              </div>
              <div style={{ padding: '20px' }}>
                <span style={{ color: '#24675d', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {course.category?.name}
                </span>
                <h3 style={{ margin: '6px 0 8px', fontSize: '1.1rem', color: '#16322f', lineHeight: 1.3 }}>
                  {course.title}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#66756f', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {course.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
                    {course.instructor?.name[0] ?? '?'}
                  </div>
                  <span style={{ fontSize: '13px', color: '#16322f', fontWeight: 600 }}>
                    {course.instructor?.name}
                  </span>
                </div>
                <div style={{ borderTop: '1px solid #e4ebe8', marginTop: '16px', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#66756f', fontSize: '12px' }}>
                    <BookOpen size={14} />
                    {course.sections?.reduce((sum: number, s: any) => sum + s.lessons.length, 0) || 0} lessons
                  </div>
                  <strong style={{ color: course.price === 0 ? '#10b981' : '#16322f', fontSize: '15px' }}>
                    {course.price === 0 ? 'Free' : `$${(course.price / 100).toFixed(2)}`}
                  </strong>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
