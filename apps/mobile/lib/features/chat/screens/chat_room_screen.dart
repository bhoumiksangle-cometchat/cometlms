import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/network/socket_client.dart';

class ChatRoomScreen extends ConsumerStatefulWidget {
  final String roomId;
  final String roomName;
  final String? otherUserId;

  const ChatRoomScreen({
    super.key,
    required this.roomId,
    required this.roomName,
    this.otherUserId,
  });

  @override
  ConsumerState<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends ConsumerState<ChatRoomScreen> {
  final List<dynamic> _messages = [];
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _socketClient = SocketClient();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchMessages();
    _setupSocketListeners();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _removeSocketListeners();
    super.dispose();
  }

  void _setupSocketListeners() {
    _socketClient.on('message:new', _onNewMessage);
    _socketClient.on('dm:message', _onNewMessage);
    
    // Join the chat room via socket
    _socketClient.emit('room:join', {'roomId': widget.roomId});
  }

  void _removeSocketListeners() {
    _socketClient.off('message:new');
    _socketClient.off('dm:message');
  }

  void _onNewMessage(dynamic data) {
    if (data == null) return;
    final msgRoomId = data['roomId']?.toString();
    if (msgRoomId == widget.roomId) {
      setState(() {
        _messages.add(data);
      });
      _scrollToBottom();
    }
  }

  Future<void> _fetchMessages() async {
    try {
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.get('/api/chat/rooms/${widget.roomId}/messages');
      final data = response.data['data'] ?? response.data;
      if (data is List) {
        setState(() {
          _messages.addAll(data);
          _isLoading = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      debugPrint('Error fetching messages: $e');
      setState(() {
        _isLoading = false;
      });
    }
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

  void _sendMessage() {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    final user = ref.read(authProvider).user;
    if (user == null) return;

    // Send via socket/API
    final payload = {
      'roomId': widget.roomId,
      'content': content,
    };

    if (widget.roomId.startsWith('dm-')) {
      _socketClient.emit('dm:send', {
        'otherUserId': widget.otherUserId ?? '',
        'content': content,
      });
    } else {
      _socketClient.emit('message:send', payload);
    }

    // Append locally for instant UI response (optimistic updates)
    final localMsg = {
      'id': 'local-${DateUtils.dateOnly(DateTime.now())}',
      'content': content,
      'sender': {
        'id': user.id,
        'name': user.name,
      },
      'createdAt': DateTime.now().toIso8601String(),
    };

    setState(() {
      _messages.add(localMsg);
    });

    _messageController.clear();
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(authProvider).user;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: Text(widget.roomName),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.videocam_outlined),
            onPressed: () {
              // Open Calling flow
              // Emit call start and navigate to call screen
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Message Thread List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      final content = msg['content'] ?? '';
                      final sender = msg['sender'];
                      final senderName = sender?['name'] ?? 'User';
                      final senderId = sender?['id'] ?? '';
                      final isMe = senderId == currentUser?.id;

                      return Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.of(context).size.width * 0.75,
                          ),
                          decoration: BoxDecoration(
                            color: isMe ? AppColors.primary : AppColors.cardDark,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isMe ? Colors.transparent : AppColors.borderDark,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (!isMe)
                                Text(
                                  senderName,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              const SizedBox(height: 4),
                              Text(
                                content,
                                style: const TextStyle(color: Colors.white, fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),

          // Message input bar
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
                    controller: _messageController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: 'Type your message...',
                      hintStyle: TextStyle(color: AppColors.textSecondary),
                      border: InputBorder.none,
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send, color: AppColors.primary),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
