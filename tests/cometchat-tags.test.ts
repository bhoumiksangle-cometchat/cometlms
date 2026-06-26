import { describe, it, expect } from 'vitest';
import {
  buildUserTags,
  buildCourseGroupTags,
  courseGroupGuid,
} from '../apps/api/src/services/cometchat.service';

/**
 * Tests for the CometChat tag helpers. Tags are how the LMS expresses
 * role-based segmentation/discovery using CometChat-native concepts:
 *   - users carry a `role:<role>` tag (queryable via tag filtering),
 *   - course groups carry `type:course` + `course:<id>` tags.
 */
describe('buildUserTags — role tags for CometChat users', () => {
  it('derives a lowercased role tag from the LMS role', () => {
    expect(buildUserTags('STUDENT')).toEqual(['role:student']);
    expect(buildUserTags('INSTRUCTOR')).toEqual(['role:instructor']);
    expect(buildUserTags('ADMIN')).toEqual(['role:admin']);
    expect(buildUserTags('SUPER_ADMIN')).toEqual(['role:super_admin']);
    expect(buildUserTags('AI_AGENT')).toEqual(['role:ai_agent']);
  });

  it('merges extra tags alongside the role tag', () => {
    expect(buildUserTags('INSTRUCTOR', ['vip', 'beta'])).toEqual([
      'role:instructor',
      'vip',
      'beta',
    ]);
  });

  it('de-duplicates tags (including a redundant role tag)', () => {
    expect(buildUserTags('ADMIN', ['role:admin', 'role:admin'])).toEqual(['role:admin']);
  });

  it('ignores blank/whitespace-only extra tags', () => {
    expect(buildUserTags('STUDENT', ['', '   '])).toEqual(['role:student']);
  });

  it('returns undefined when there is nothing to tag', () => {
    expect(buildUserTags(undefined)).toBeUndefined();
    expect(buildUserTags(undefined, [])).toBeUndefined();
    expect(buildUserTags(undefined, ['', '  '])).toBeUndefined();
  });

  it('returns tags from extras even without a role', () => {
    expect(buildUserTags(undefined, ['kind:agent'])).toEqual(['kind:agent']);
  });
});

describe('buildCourseGroupTags — tags for course discussion groups', () => {
  it('always includes the type and course tags', () => {
    expect(buildCourseGroupTags('abc123')).toEqual(['type:course', 'course:abc123']);
  });

  it('uses the same course id format as the group guid', () => {
    const courseId = 'react-foundations';
    const tags = buildCourseGroupTags(courseId);
    expect(tags).toContain(`course:${courseId}`);
    expect(courseGroupGuid(courseId)).toBe(`course-${courseId}`);
  });

  it('merges and de-duplicates extra tags', () => {
    expect(buildCourseGroupTags('c1', ['category:web', 'type:course'])).toEqual([
      'type:course',
      'course:c1',
      'category:web',
    ]);
  });
});
