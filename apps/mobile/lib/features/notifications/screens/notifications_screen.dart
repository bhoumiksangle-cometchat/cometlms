import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

final notificationsProvider = FutureProvider<List<dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/notifications');
  final data = response.data['data'] ?? response.data;
  return data is List ? data : [];
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        actions: [
          TextButton(
            onPressed: () async {
              try {
                final apiClient = ref.read(apiClientProvider);
                await apiClient.post('/api/notifications/mark-all-read');
                ref.invalidate(notificationsProvider);
              } catch (_) {}
            },
            child: const Text('Mark all read', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
      body: notificationsAsync.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return const Center(
              child: Text(
                'All caught up!',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(notificationsProvider);
            },
            color: AppColors.primary,
            child: ListView.builder(
              itemCount: notifications.length,
              itemBuilder: (context, index) {
                final notification = notifications[index];
                final title = notification['title'] ?? 'Notification';
                final body = notification['body'] ?? '';
                final isRead = notification['read'] ?? notification['isRead'] ?? false;

                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: isRead ? AppColors.cardDark : AppColors.primary.withOpacity(0.2),
                    child: Icon(
                      Icons.notifications,
                      color: isRead ? AppColors.textSecondary : AppColors.primary,
                    ),
                  ),
                  title: Text(
                    title,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                    ),
                  ),
                  subtitle: Text(
                    body,
                    style: const TextStyle(color: AppColors.textSecondary),
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (err, stack) => Center(
          child: Text(
            'Error loading notifications: $err',
            style: const TextStyle(color: AppColors.error),
          ),
        ),
      ),
    );
  }
}
