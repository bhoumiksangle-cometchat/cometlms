import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

final adminStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/admin/stats');
  return Map<String, dynamic>.from(response.data['data'] ?? response.data);
});

final adminFlagsProvider = FutureProvider<List<dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/admin/moderation');
  final data = response.data['data'] ?? response.data;
  return data is List ? data : [];
});

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(adminStatsProvider);
    final flagsAsync = ref.watch(adminFlagsProvider);

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          title: const Text('Admin Portal'),
          backgroundColor: AppColors.backgroundDark,
          elevation: 0,
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.analytics_outlined), text: 'Analytics'),
              Tab(icon: Icon(Icons.gavel_outlined), text: 'Moderation'),
            ],
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: Colors.white60,
          ),
        ),
        body: TabBarView(
          children: [
            // Stats Tab
            statsAsync.when(
              data: (stats) {
                final users = stats['users']?.toString() ?? '0';
                final courses = stats['courses']?.toString() ?? '0';
                final enrollments = stats['enrollments']?.toString() ?? '0';
                final score = stats['engagementScore']?.toString() ?? 'N/A';

                return GridView.count(
                  crossAxisCount: 2,
                  padding: const EdgeInsets.all(16),
                  mainAxisSpacing: 16,
                  crossAxisSpacing: 16,
                  children: [
                    _buildStatCard('Total Users', users, Icons.people, AppColors.primary),
                    _buildStatCard('Courses', courses, Icons.book, AppColors.primary),
                    _buildStatCard('Enrollments', enrollments, Icons.assignment, AppColors.primary),
                    _buildStatCard('Engagement', '$score%', Icons.speed, AppColors.primary),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              error: (e, s) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
            ),

            // Moderation Tab
            flagsAsync.when(
              data: (flags) {
                if (flags.isEmpty) {
                  return const Center(
                    child: Text('No pending moderation items.', style: TextStyle(color: AppColors.textSecondary)),
                  );
                }

                return ListView.builder(
                  itemCount: flags.length,
                  padding: const EdgeInsets.all(16),
                  itemBuilder: (context, index) {
                    final item = flags[index];
                    final id = item['id']?.toString() ?? '';
                    final content = item['content'] ?? 'Flagged item';
                    final reason = item['reason'] ?? 'Inappropriate content';

                    return Card(
                      color: AppColors.cardDark,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: AppColors.borderDark),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Reason: $reason',
                              style: const TextStyle(color: AppColors.error, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '"$content"',
                              style: const TextStyle(color: Colors.white, fontStyle: FontStyle.italic),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                TextButton(
                                  onPressed: () async {
                                    final apiClient = ref.read(apiClientProvider);
                                    await apiClient.post('/api/admin/moderation/$id/dismiss');
                                    ref.invalidate(adminFlagsProvider);
                                  },
                                  child: const Text('Dismiss'),
                                ),
                                const SizedBox(width: 8),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                                  onPressed: () async {
                                    final apiClient = ref.read(apiClientProvider);
                                    await apiClient.post('/api/admin/moderation/$id/ban');
                                    ref.invalidate(adminFlagsProvider);
                                    ref.invalidate(adminStatsProvider);
                                  },
                                  child: const Text('Ban User', style: TextStyle(color: Colors.white)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
              error: (e, s) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderDark),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 36, color: color),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
