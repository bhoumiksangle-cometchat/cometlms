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

final adminUsersProvider = FutureProvider<List<dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/admin/users');
  final data = response.data['data'] ?? response.data;
  return data is List ? data : [];
});

final adminEngagementProvider = FutureProvider.family<Map<String, dynamic>, int>((ref, days) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/admin/engagement', queryParameters: {'days': days});
  final data = response.data['data'] ?? response.data;
  return data is Map<String, dynamic> ? data : {};
});

class AdminDashboardScreen extends ConsumerStatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  ConsumerState<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends ConsumerState<AdminDashboardScreen> {
  String _userSearchQuery = '';
  int _engagementDays = 7;

  @override
  Widget build(BuildContext context) {
    final statsAsync = ref.watch(adminStatsProvider);
    final flagsAsync = ref.watch(adminFlagsProvider);
    final usersAsync = ref.watch(adminUsersProvider);
    final engagementAsync = ref.watch(adminEngagementProvider(_engagementDays));

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          title: const Text('Admin Portal'),
          backgroundColor: AppColors.backgroundDark,
          elevation: 0,
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(icon: Icon(Icons.analytics_outlined), text: 'Analytics'),
              Tab(icon: Icon(Icons.gavel_outlined), text: 'Moderation'),
              Tab(icon: Icon(Icons.people_outline), text: 'Users'),
              Tab(icon: Icon(Icons.insights_outlined), text: 'Engagement'),
            ],
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: Colors.white60,
          ),
        ),
        body: TabBarView(
          children: [
            // Analytics Tab
            _buildAnalyticsTab(statsAsync),

            // Moderation Tab
            _buildModerationTab(flagsAsync),

            // Users Tab
            _buildUsersTab(usersAsync),

            // Engagement Tab
            _buildEngagementTab(engagementAsync),
          ],
        ),
      ),
    );
  }

  Widget _buildAnalyticsTab(AsyncValue<Map<String, dynamic>> statsAsync) {
    return statsAsync.when(
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
    );
  }

  Widget _buildModerationTab(AsyncValue<List<dynamic>> flagsAsync) {
    return flagsAsync.when(
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
    );
  }

  Widget _buildUsersTab(AsyncValue<List<dynamic>> usersAsync) {
    return usersAsync.when(
      data: (users) {
        // Filter users by search query
        final filteredUsers = _userSearchQuery.isEmpty
            ? users
            : users.where((u) {
                final name = (u['name'] ?? '').toString().toLowerCase();
                final email = (u['email'] ?? '').toString().toLowerCase();
                final query = _userSearchQuery.toLowerCase();
                return name.contains(query) || email.contains(query);
              }).toList();

        return Column(
          children: [
            // Search bar
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Search users by name or email...',
                  hintStyle: const TextStyle(color: AppColors.textSecondary),
                  prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
                  filled: true,
                  fillColor: AppColors.cardDark,
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.borderDark),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: AppColors.primary),
                  ),
                ),
                onChanged: (value) => setState(() => _userSearchQuery = value),
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async => ref.invalidate(adminUsersProvider),
                color: AppColors.primary,
                child: ListView.builder(
                  itemCount: filteredUsers.length,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemBuilder: (context, index) {
                    final user = filteredUsers[index];
                    final name = user['name'] ?? 'Unknown';
                    final email = user['email'] ?? '';
                    final role = user['role'] ?? 'STUDENT';
                    final isActive = user['isActive'] ?? true;
                    final avatarUrl = user['avatarUrl'] ?? '';
                    final userId = user['id']?.toString() ?? '';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: AppColors.cardDark,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.borderDark),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: AppColors.primary.withOpacity(0.2),
                          backgroundImage: avatarUrl.isNotEmpty ? NetworkImage(avatarUrl) : null,
                          child: avatarUrl.isEmpty
                              ? Text(name[0].toUpperCase(), style: const TextStyle(color: AppColors.primary))
                              : null,
                        ),
                        title: Row(
                          children: [
                            Expanded(
                              child: Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            ),
                            _buildRolePill(role),
                          ],
                        ),
                        subtitle: Row(
                          children: [
                            Expanded(
                              child: Text(email, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            ),
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isActive ? AppColors.success : AppColors.error,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              isActive ? 'Active' : 'Suspended',
                              style: TextStyle(
                                color: isActive ? AppColors.success : AppColors.error,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                        trailing: PopupMenuButton<String>(
                          color: AppColors.cardDark,
                          onSelected: (action) => _handleUserAction(action, userId),
                          itemBuilder: (_) => [
                            if (isActive)
                              const PopupMenuItem(value: 'suspend', child: Text('Suspend', style: TextStyle(color: AppColors.error))),
                            if (!isActive)
                              const PopupMenuItem(value: 'activate', child: Text('Activate', style: TextStyle(color: AppColors.success))),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (e, s) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
    );
  }

  Widget _buildEngagementTab(AsyncValue<Map<String, dynamic>> engagementAsync) {
    return engagementAsync.when(
      data: (engagement) {
        final totalMessages = engagement['totalMessages']?.toString() ?? '0';
        final totalReactions = engagement['totalReactions']?.toString() ?? '0';
        final callMinutes = engagement['callMinutes']?.toString() ?? '0';
        final flagged = engagement['flagged']?.toString() ?? '0';
        final courses = engagement['courses'] as List? ?? [];

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Time range selector
              Row(
                children: [
                  const Text('Time Range: ', style: TextStyle(color: AppColors.textSecondary)),
                  DropdownButton<int>(
                    value: _engagementDays,
                    dropdownColor: AppColors.cardDark,
                    style: const TextStyle(color: Colors.white),
                    underline: const SizedBox.shrink(),
                    items: const [
                      DropdownMenuItem(value: 7, child: Text('Last 7 days')),
                      DropdownMenuItem(value: 14, child: Text('Last 14 days')),
                      DropdownMenuItem(value: 30, child: Text('Last 30 days')),
                      DropdownMenuItem(value: 90, child: Text('Last 90 days')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _engagementDays = value);
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Summary metric cards
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.6,
                children: [
                  _buildEngagementMetric('Messages', totalMessages, Icons.message_outlined, AppColors.primary),
                  _buildEngagementMetric('Reactions', totalReactions, Icons.thumb_up_outlined, AppColors.success),
                  _buildEngagementMetric('Call Minutes', callMinutes, Icons.call_outlined, AppColors.info),
                  _buildEngagementMetric('Flagged', flagged, Icons.flag_outlined, AppColors.error),
                ],
              ),
              const SizedBox(height: 24),

              // Per-course breakdown
              const Text(
                'Per-Course Breakdown',
                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              if (courses.isEmpty)
                const Text('No course data available.', style: TextStyle(color: AppColors.textSecondary))
              else
                ...courses.map((course) {
                  final c = course as Map<String, dynamic>;
                  final courseName = c['title'] ?? c['name'] ?? 'Unknown Course';
                  final msgs = c['messages']?.toString() ?? '0';
                  final reactions = c['reactions']?.toString() ?? '0';
                  final minutes = c['callMinutes']?.toString() ?? '0';
                  final courseFlagged = c['flagged'] ?? 0;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.cardDark,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.borderDark),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(courseName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildMiniMetric('Msgs', msgs, AppColors.primary),
                            _buildMiniMetric('Reactions', reactions, AppColors.success),
                            _buildMiniMetric('Mins', minutes, AppColors.info),
                            _buildMiniMetric(
                              'Flagged',
                              courseFlagged.toString(),
                              AppColors.error,
                              highlight: courseFlagged > 0,
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      error: (e, s) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
    );
  }

  void _handleUserAction(String action, String userId) async {
    final apiClient = ref.read(apiClientProvider);
    try {
      if (action == 'suspend') {
        await apiClient.post('/api/admin/users/$userId/suspend');
      } else if (action == 'activate') {
        await apiClient.post('/api/admin/users/$userId/activate');
      }
      ref.invalidate(adminUsersProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Action failed: $e')),
        );
      }
    }
  }

  Widget _buildRolePill(String role) {
    Color color;
    switch (role.toUpperCase()) {
      case 'ADMIN':
        color = AppColors.warning;
        break;
      case 'SUPER_ADMIN':
        color = AppColors.error;
        break;
      case 'INSTRUCTOR':
        color = AppColors.info;
        break;
      case 'AI_AGENT':
        color = const Color(0xFF8B5CF6); // purple
        break;
      default:
        color = AppColors.success;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.5)),
      ),
      child: Text(
        role.replaceAll('_', ' '),
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
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

  Widget _buildEngagementMetric(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderDark),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 6),
              Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            ],
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildMiniMetric(String label, String value, Color color, {bool highlight = false}) {
    return Column(
      children: [
        Container(
          padding: highlight ? const EdgeInsets.symmetric(horizontal: 6, vertical: 2) : EdgeInsets.zero,
          decoration: highlight
              ? BoxDecoration(
                  color: color.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(4),
                )
              : null,
          child: Text(
            value,
            style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 10)),
      ],
    );
  }
}
