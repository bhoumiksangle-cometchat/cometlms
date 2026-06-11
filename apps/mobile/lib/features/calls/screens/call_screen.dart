import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/socket_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/webrtc_service.dart';

class CallScreen extends StatefulWidget {
  final String roomId;
  final String? targetUserId;
  final String? callId;
  final String callType; // 'voice' or 'video'
  final bool isIncoming;

  const CallScreen({
    super.key,
    required this.roomId,
    this.targetUserId,
    this.callId,
    required this.callType,
    this.isIncoming = false,
  });

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  final _webrtc = WebRTCService.instance;
  final _socketClient = SocketClient();
  bool _isMuted = false;
  bool _isCameraOff = false;
  bool _isSpeakerOn = true;

  @override
  void initState() {
    super.initState();
    _webrtc.configureCall(
      targetUserId: widget.targetUserId,
      callId: widget.callId,
    );
    _webrtc.initialize();

    if (widget.isIncoming) {
      _socketClient.emit('call:accepted', {
        'targetUserId': widget.targetUserId,
      });
    }
  }

  @override
  void dispose() {
    _webrtc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isVideo = widget.callType == 'video';

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: Stack(
        children: [
          // Background representing Remote Video Feed (mocking a beautiful abstract avatar or gradient)
          Positioned.fill(
            child: isVideo && !_isCameraOff
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      RTCVideoView(_webrtc.remoteRenderer),
                      Positioned(
                        right: 16,
                        top: 120,
                        child: SizedBox(
                          width: 120,
                          height: 180,
                          child: RTCVideoView(
                            _webrtc.localRenderer,
                            mirror: true,
                          ),
                        ),
                      ),
                    ],
                  )
                : Container(
                    color: AppColors.backgroundDark,
                    child: const Center(
                      child: Icon(Icons.record_voice_over, size: 120, color: AppColors.primary),
                    ),
                  ),
          ),

          // Top Header / Call Info Overlay
          Positioned(
            top: 60,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.black45,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: AppColors.primary,
                    child: Icon(Icons.school, color: Colors.white),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Office Hours Call',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Room ID: ${widget.roomId}',
                          style: const TextStyle(color: Colors.white60, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Control Overlay
          Positioned(
            bottom: 48,
            left: 32,
            right: 32,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // Mute mic
                _buildControlButton(
                  icon: _isMuted ? Icons.mic_off : Icons.mic,
                  color: _isMuted ? AppColors.error : Colors.white12,
                  onPressed: () {
                    setState(() {
                      _isMuted = !_isMuted;
                    });
                  },
                ),

                // Camera Toggle
                if (isVideo)
                  _buildControlButton(
                    icon: _isCameraOff ? Icons.videocam_off : Icons.videocam,
                    color: _isCameraOff ? AppColors.error : Colors.white12,
                    onPressed: () {
                      setState(() {
                        _isCameraOff = !_isCameraOff;
                      });
                    },
                  ),

                // Speaker toggle
                _buildControlButton(
                  icon: _isSpeakerOn ? Icons.volume_up : Icons.volume_down,
                  color: _isSpeakerOn ? AppColors.primary : Colors.white12,
                  onPressed: () {
                    setState(() {
                      _isSpeakerOn = !_isSpeakerOn;
                    });
                  },
                ),

                // Hang Up
                _buildControlButton(
                  icon: Icons.call_end,
                  color: AppColors.error,
                  onPressed: () {
                    _socketClient.emit('call:ended', {
                      'roomId': widget.roomId,
                      'duration': 0,
                      'callId': widget.callId ?? widget.roomId,
                    });
                    context.pop();
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white10),
      ),
      child: IconButton(
        icon: Icon(icon, color: Colors.white, size: 28),
        onPressed: onPressed,
      ),
    );
  }
}
