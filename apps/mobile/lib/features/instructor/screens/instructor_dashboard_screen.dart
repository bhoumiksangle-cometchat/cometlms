import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

// Provider for instructor's courses
final instructorCoursesProvider = FutureProvider<List<dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/courses/my-courses');
  final data = response.data['data'] ?? response.data;
  return data is List ? data : [];
});

class InstructorDashboardScreen extends ConsumerWidget {
  const InstructorDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Instructor Console'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Welcome Section
            Text(
              'Welcome, ${user?.name ?? 'Instructor'}',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Manage your courses, view student statistics, and host live sessions.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),

            // Metrics Cards Row
            Row(
              children: [
                Expanded(
                  child: _buildMetricCard('Total Students', '1,280', Icons.people_outline),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildMetricCard('Total Earnings', '\$4,890', Icons.monetization_on_outlined),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Action Items
            const Text(
              'Quick Actions',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 12),

            _buildActionTile(
              context,
              'Create New Course',
              'Set up a new curriculum, lessons, and assignments',
              Icons.add_to_photos_outlined,
              () {
                context.push('/instructor/create-course');
              },
            ),
            const SizedBox(height: 12),
            _buildActionTile(
              context,
              'Host Live Office Hours',
              'Start a group video call for Q&A with students',
              Icons.video_call_outlined,
              () => _showOfficeHoursDialog(context, ref),
            ),
          ],
        ),
      ),
    );
  }

  void _showOfficeHoursDialog(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.read(instructorCoursesProvider);
    coursesAsync.when(
      data: (courses) {
        if (courses.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No courses found. Create a course first.')),
          );
          return;
        }
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: AppColors.cardDark,
            title: const Text('Select Course', style: TextStyle(color: Colors.white)),
            content: SizedBox(
              width: double.maxFinite,
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: courses.length,
                itemBuilder: (_, index) {
                  final course = courses[index];
                  final title = course['title'] ?? 'Untitled';
                  final courseId = course['id']?.toString() ?? '';
                  return ListTile(
                    title: Text(title, style: const TextStyle(color: Colors.white)),
                    onTap: () {
                      Navigator.of(ctx).pop();
                      _startGroupCall(context, courseId);
                    },
                  );
                },
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
            ],
          ),
        );
      },
      loading: () {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Loading courses...')),
        );
      },
      error: (e, _) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading courses: $e')),
        );
      },
    );
  }

  void _startGroupCall(BuildContext context, String courseId) {
    final groupId = 'course-$courseId';
    CometChat.getGroup(
      groupId,
      onSuccess: (group) {
        // Initiate a group video call
        final call = Call(
          receiverUid: group.guid,
          receiverType: ReceiverTypeConstants.group,
          type: CallTypeConstants.videoCall,
        );
        CometChat.initiateCall(
          call,
          onSuccess: (initiatedCall) {
            debugPrint('[OfficeHours] Group call initiated for $groupId');
          },
          onError: (e) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Failed to start call: ${e.message}')),
            );
          },
        );
      },
      onError: (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Group not found: ${e.message}')),
        );
      },
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primary, size: 24),
          const SizedBox(height: 16),
          Text(
            value,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile(BuildContext context, String title, String subtitle, IconData icon, VoidCallback onTap) {
    return ListTile(
      onTap: onTap,
      tileColor: AppColors.cardDark,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.borderDark),
      ),
      leading: Icon(icon, color: AppColors.primary, size: 28),
      title: Text(
        title,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
      ),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
    );
  }
}
