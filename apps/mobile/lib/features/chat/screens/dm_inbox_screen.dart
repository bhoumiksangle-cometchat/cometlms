import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

final conversationsProvider = FutureProvider<List<dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/chat/conversations');
  final data = response.data['data'] ?? response.data;
  return data is List ? data : [];
});

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationsAsync = ref.watch(conversationsProvider);

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Messages'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
      ),
      body: conversationsAsync.when(
        data: (conversations) {
          if (conversations.isEmpty) {
            return const Center(
              child: Text(
                'No conversations yet.',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(conversationsProvider);
            },
            color: AppColors.primary,
            child: ListView.builder(
              itemCount: conversations.length,
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemBuilder: (context, index) {
                final conversation = conversations[index];
                final roomId = conversation['roomId'] ?? conversation['id'] ?? '';
                final name = conversation['name'] ?? 'Chat Room';
                final lastMessage = conversation['lastMessage']?['content'] ?? '';
                final lastMessageTime = conversation['lastMessage']?['createdAt'] ?? '';
                final type = conversation['type'] ?? 'GROUP';

                return ListTile(
                  onTap: () {
                    context.push('/chat/$roomId', extra: {
                      'roomName': name,
                    });
                  },
                  leading: CircleAvatar(
                    backgroundColor: AppColors.primary.withOpacity(0.2),
                    child: Icon(
                      type == 'DM' ? Icons.person : Icons.group,
                      color: AppColors.primary,
                    ),
                  ),
                  title: Text(
                    name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  subtitle: Text(
                    lastMessage,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  trailing: const Icon(
                    Icons.chevron_right,
                    color: AppColors.textSecondary,
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
            'Error loading inbox: $err',
            style: const TextStyle(color: AppColors.error),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Trigger DM / contact list overlay or logic
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Starting new direct message...')),
          );
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.chat_bubble_outline, color: Colors.white),
      ),
    );
  }
}
