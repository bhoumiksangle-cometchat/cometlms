import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';
import '../../../core/theme/app_theme.dart';

/// CometChat-powered conversations screen with 3 tabs: Chats, Users, Calls.
/// Matches the web app's Messages page sidebar layout.
class ConversationsScreen extends StatelessWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          title: const Text('Messages'),
          backgroundColor: AppColors.backgroundDark,
          elevation: 0,
          bottom: const TabBar(
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textSecondary,
            tabs: [
              Tab(text: 'Chats'),
              Tab(text: 'Users'),
              Tab(text: 'Calls'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Chats tab — existing conversations
            CometChatConversations(
              onItemTap: (conversation) {
                final conversationWith = conversation.conversationWith;
                final type = conversation.conversationType;

                if (type == 'user' && conversationWith is User) {
                  context.push('/messages', extra: {'user': conversationWith});
                } else if (type == 'group' && conversationWith is Group) {
                  context.push('/messages', extra: {'group': conversationWith});
                }
              },
            ),

            // Users tab — browse all platform users
            CometChatUsers(
              onItemTap: (context, user) {
                context.push('/messages', extra: {'user': user});
              },
            ),

            // Calls tab — call history/logs
            const CometChatCallLogs(),
          ],
        ),
      ),
    );
  }
}
