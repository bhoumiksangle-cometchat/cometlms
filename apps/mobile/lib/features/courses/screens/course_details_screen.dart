import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

// Providers for enrollment state checking
final enrollmentsProvider = FutureProvider<List<dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/enrollments/me');
  final data = response.data['data'] ?? response.data;
  return data is List ? data : [];
});

class CourseDetailsScreen extends ConsumerStatefulWidget {
  final String courseId;
  final dynamic courseData;

  const CourseDetailsScreen({
    super.key,
    required this.courseId,
    this.courseData,
  });

  @override
  ConsumerState<CourseDetailsScreen> createState() => _CourseDetailsScreenState();
}

class _CourseDetailsScreenState extends ConsumerState<CourseDetailsScreen> {
  bool _isEnrolling = false;

  @override
  Widget build(BuildContext context) {
    final enrollmentsAsync = ref.watch(enrollmentsProvider);
    final course = widget.courseData;

    if (course == null) {
      return const Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: Center(
          child: Text('No course details available.', style: TextStyle(color: Colors.white)),
        ),
      );
    }

    final title = course['title'] ?? 'Untitled Course';
    final description = course['description'] ?? '';
    final syllabus = course['syllabus'] as List? ?? [];

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: CustomScrollView(
        slivers: [
          // Collapsible AppBar
          SliverAppBar(
            expandedHeight: 220,
            pinned: true,
            backgroundColor: AppColors.backgroundDark,
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  shadows: [Shadow(blurRadius: 10, color: Colors.black87)],
                ),
              ),
              background: course['thumbnailUrl'] != null && course['thumbnailUrl'].toString().isNotEmpty
                  ? Image.network(course['thumbnailUrl'], fit: BoxFit.cover)
                  : Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.gradientStart, AppColors.gradientEnd],
                        ),
                      ),
                      child: const Icon(Icons.school, size: 64, color: Colors.white),
                    ),
            ),
          ),

          // Course content info
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'About this Course',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Enroll Button or Play Button
                  enrollmentsAsync.when(
                    data: (enrollments) {
                      final isEnrolled = enrollments.any(
                        (e) => e['courseId']?.toString() == widget.courseId,
                      );

                      if (isEnrolled) {
                        return SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              context.push('/course/${widget.courseId}/player');
                            },
                            icon: const Icon(Icons.play_arrow, color: Colors.white),
                            label: const Text('Resume Learning', style: TextStyle(color: Colors.white)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        );
                      }

                      return SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _isEnrolling
                              ? null
                              : () async {
                                  setState(() {
                                    _isEnrolling = true;
                                  });
                                  try {
                                    final apiClient = ref.read(apiClientProvider);
                                    await apiClient.post('/api/enrollments', data: {
                                      'courseId': widget.courseId,
                                    });
                                    ref.invalidate(enrollmentsProvider);
                                    if (mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Successfully enrolled!')),
                                      );
                                    }
                                  } catch (e) {
                                    if (mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Enrollment failed: $e')),
                                      );
                                    }
                                  } finally {
                                    setState(() {
                                      _isEnrolling = false;
                                    });
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: _isEnrolling
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation(Colors.white),
                                  ),
                                )
                              : const Text('Enroll in Course', style: TextStyle(color: Colors.white)),
                        ),
                      );
                    },
                    loading: () => const Center(
                      child: CircularProgressIndicator(color: AppColors.primary),
                    ),
                    error: (e, s) => Text('Error loading status: $e', style: const TextStyle(color: AppColors.error)),
                  ),
                  const SizedBox(height: 32),

                  const Text(
                    'Syllabus & Curriculum',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),

          // Syllabus / Lectures list
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final section = syllabus[index];
                final sectionTitle = section['title'] ?? 'Section ${index + 1}';
                final lessons = section['lessons'] as List? ?? [];

                return ExpansionTile(
                  title: Text(
                    sectionTitle,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                  iconColor: AppColors.primary,
                  collapsedIconColor: Colors.white,
                  children: lessons.map((lesson) {
                    final lessonTitle = lesson['title'] ?? 'Untitled Lesson';
                    final duration = lesson['duration'] ?? '';

                    return ListTile(
                      leading: const Icon(Icons.play_circle_outline, color: AppColors.primary),
                      title: Text(
                        lessonTitle,
                        style: const TextStyle(color: Colors.white70),
                      ),
                      trailing: duration.isNotEmpty
                          ? Text(
                              duration,
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                            )
                          : null,
                    );
                  }).toList(),
                );
              },
              childCount: syllabus.length,
            ),
          ),
        ],
      ),
    );
  }
}
