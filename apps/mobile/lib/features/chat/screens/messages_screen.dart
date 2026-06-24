import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import '../../../core/theme/app_theme.dart';

/// CometChat-powered messages screen.
/// Renders message header, list, and composer for either a 1:1 or group chat.
/// Includes voice/video call buttons in the header.
class MessagesScreen extends StatelessWidget {
  final User? user;
  final Group? group;

  const MessagesScreen({super.key, this.user, this.group});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: false, // REQUIRED — composer handles keyboard
      backgroundColor: AppColors.backgroundDark,
      appBar: CometChatMessageHeader(
        user: user,
        group: group,
        onBack: () => context.pop(),
      ),
      body: Column(
        children: [
          Expanded(
            child: CometChatMessageList(user: user, group: group),
          ),
          CometChatMessageComposer(user: user, group: group),
        ],
      ),
    );
  }
}
