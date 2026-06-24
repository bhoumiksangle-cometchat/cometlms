import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/auth_provider.dart';

/// Response model for course progress.
class CourseProgress {
  final int totalLessons;
  final int completedLessons;
  final double progressPercentage;
  final List<String> completedLessonIds;

  CourseProgress({
    required this.totalLessons,
    required this.completedLessons,
    required this.progressPercentage,
    required this.completedLessonIds,
  });

  factory CourseProgress.fromJson(Map<String, dynamic> json) {
    return CourseProgress(
      totalLessons: json['totalLessons'] ?? 0,
      completedLessons: json['completedLessons'] ?? 0,
      progressPercentage: (json['progressPercentage'] ?? 0).toDouble(),
      completedLessonIds: List<String>.from(json['completedLessonIds'] ?? []),
    );
  }
}

/// Fetches course progress for the current user.
final courseProgressProvider = FutureProvider.family<CourseProgress, String>((ref, courseId) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/courses/$courseId/progress');
  final data = response.data['data'] ?? response.data;
  return CourseProgress.fromJson(data is Map<String, dynamic> ? data : {});
});
