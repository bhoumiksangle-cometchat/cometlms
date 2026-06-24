import 'package:flutter/material.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';
import '../../../core/theme/app_theme.dart';

/// Course discussion powered by CometChat group messages.
/// Used in the course player's Discussion tab.
/// Shows call buttons for the group to enable office hours / group calls.
class CourseDiscussionWidget extends StatefulWidget {
  final String groupId; // format: "course-{courseId}"

  const CourseDiscussionWidget({super.key, required this.groupId});

  @override
  State<CourseDiscussionWidget> createState() => _CourseDiscussionWidgetState();
}

class _CourseDiscussionWidgetState extends State<CourseDiscussionWidget> {
  Group? _group;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadGroup();
  }

  Future<void> _loadGroup() async {
    try {
      CometChat.getGroup(
        widget.groupId,
        onSuccess: (group) {
          if (mounted) {
            setState(() {
              _group = group;
              _loading = false;
            });
          }
        },
        onError: (e) {
          if (mounted) {
            setState(() {
              _error = 'Failed to load discussion';
              _loading = false;
            });
          }
        },
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load discussion';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }
    if (_error != null || _group == null) {
      return Center(
        child: Text(
          _error ?? 'Discussion not available',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
      );
    }
    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Column(
        children: [
          // Header with group call button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Expanded(
                  child: Text(
                    'Course Discussion',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                CometChatCallButtons(group: _group),
              ],
            ),
          ),
          const Divider(color: AppColors.borderDark, height: 1),
          Expanded(child: CometChatMessageList(group: _group)),
          CometChatMessageComposer(group: _group),
        ],
      ),
    );
  }
}
