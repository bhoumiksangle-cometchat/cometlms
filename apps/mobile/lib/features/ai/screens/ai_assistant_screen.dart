import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

class Message {
  final String content;
  final bool isUser;
  final DateTime timestamp;

  Message({required this.content, required this.isUser, required this.timestamp});
}

class AIAssistantScreen extends ConsumerStatefulWidget {
  const AIAssistantScreen({super.key});

  @override
  ConsumerState<AIAssistantScreen> createState() => _AIAssistantScreenState();
}

class _AIAssistantScreenState extends ConsumerState<AIAssistantScreen> {
  final List<Message> _messages = [
    Message(
      content: 'Hello! I am your AI Study Copilot. How can I help you learn today?',
      isUser: false,
      timestamp: DateTime.now(),
    ),
  ];
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  bool _isLoading = false;

  final List<String> _suggestions = [
    'Explain React hooks',
    'Summarize Python basics',
    'Help me prepare a study plan',
    'Explain binary search',
  ];

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    setState(() {
      _messages.add(Message(content: text, isUser: true, timestamp: DateTime.now()));
      _isLoading = true;
    });
    _scrollToBottom();
    _textController.clear();

    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post('/api/chat/agents/message', data: {
        'prompt': text,
      });

      final data = response.data['data'];
      final String reply = data is Map
          ? (data['content']?.toString() ?? 'I could not generate a reply.')
          : data?.toString() ?? 'I could not generate a reply.';
      
      setState(() {
        _messages.add(Message(content: reply, isUser: false, timestamp: DateTime.now()));
      });
    } catch (e) {
      setState(() {
        _messages.add(Message(
          content: 'Sorry, I encountered an error: ${e.toString()}',
          isUser: false,
          timestamp: DateTime.now(),
        ));
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('AI Study Copilot'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Chat Bubbles
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final message = _messages[index];
                return Align(
                  alignment: message.isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.75,
                    ),
                    decoration: BoxDecoration(
                      color: message.isUser ? AppColors.primary : AppColors.cardDark,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft: Radius.circular(message.isUser ? 16 : 4),
                        bottomRight: Radius.circular(message.isUser ? 4 : 16),
                      ),
                      border: Border.all(
                        color: message.isUser ? Colors.transparent : AppColors.borderDark,
                      ),
                    ),
                    child: Text(
                      message.content,
                      style: TextStyle(
                        color: message.isUser ? Colors.white : AppColors.textPrimary,
                        fontSize: 15,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),

          // Suggestions List
          if (_messages.length == 1 && !_isLoading)
            SizedBox(
              height: 48,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _suggestions.length,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: ActionChip(
                      label: Text(_suggestions[index]),
                      backgroundColor: AppColors.cardDark,
                      labelStyle: const TextStyle(color: AppColors.primary),
                      side: const BorderSide(color: AppColors.borderDark),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      onPressed: () => _sendMessage(_suggestions[index]),
                    ),
                  );
                },
              ),
            ),

          if (_isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8.0),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(AppColors.primary)),
                ),
              ),
            ),

          // Input Bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppColors.cardDark,
              border: Border(top: BorderSide(color: AppColors.borderDark)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Ask your copilot anything...',
                      hintStyle: const TextStyle(color: AppColors.textSecondary),
                      border: InputBorder.none,
                    ),
                    onSubmitted: _sendMessage,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send, color: AppColors.primary),
                  onPressed: () => _sendMessage(_textController.text),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
