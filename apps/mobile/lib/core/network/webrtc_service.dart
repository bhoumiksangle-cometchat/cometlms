import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'socket_client.dart';

class WebRTCService {
  static final WebRTCService instance = WebRTCService._();
  WebRTCService._();

  RTCPeerConnection? peerConnection;
  MediaStream? localStream;
  final RTCVideoRenderer localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer remoteRenderer = RTCVideoRenderer();
  String? targetUserId;
  String? callId;

  void configureCall({String? targetUserId, String? callId}) {
    this.targetUserId = targetUserId;
    this.callId = callId;
  }

  Future<void> initialize() async {
    await localRenderer.initialize();
    await remoteRenderer.initialize();
    localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': true,
    });

    peerConnection = await createPeerConnection({
      'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'}
      ]
    });

    peerConnection!.onIceCandidate = (candidate) {
      SocketClient().emit('call:signal', {
        'targetUserId': targetUserId,
        'callId': callId,
        'signal': {
          'type': 'ice-candidate',
          'candidate': candidate.toMap(),
        }
      });
    };

    peerConnection!.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        remoteRenderer.srcObject = event.streams.first;
      }
    };

    SocketClient().on('call:signal', (data) {
      final signal = data is Map ? data['signal'] : null;
      handleSignal(signal);
    });

    SocketClient().on('call:accepted', (_) async {
      final offer = await createOffer();
      SocketClient().emit('call:signal', {
        'targetUserId': targetUserId,
        'callId': callId,
        'signal': offer,
      });
    });

    for (final track in localStream!.getTracks()) {
      await peerConnection!.addTrack(track, localStream!);
    }

    localRenderer.srcObject = localStream;
  }

  Future<void> dispose() async {
    await localRenderer.dispose();
    await remoteRenderer.dispose();
    await localStream?.dispose();
    await peerConnection?.close();
  }

  Future<Map<String, dynamic>> createOffer() async {
    final offer = await peerConnection!.createOffer();
    await peerConnection!.setLocalDescription(offer);
    return offer.toMap();
  }

  Future<void> applyRemoteDescription(Map<String, dynamic> data) async {
    await peerConnection!.setRemoteDescription(
      RTCSessionDescription(data['sdp'], data['type']),
    );
  }

  Future<Map<String, dynamic>> createAnswer() async {
    final answer = await peerConnection!.createAnswer();
    await peerConnection!.setLocalDescription(answer);
    return answer.toMap();
  }

  Future<void> addIceCandidate(Map<String, dynamic> candidateData) async {
    await peerConnection?.addCandidate(
      RTCIceCandidate(
        candidateData['candidate'],
        candidateData['sdpMid'],
        candidateData['sdpMLineIndex'],
      ),
    );
  }

  void handleSignal(dynamic signal) async {
    if (signal == null) return;

    final type = signal['type'];

    if (type == 'offer') {
      await applyRemoteDescription(signal);
      final answer = await createAnswer();
      SocketClient().emit('call:signal', {
        'targetUserId': targetUserId,
        'callId': callId,
        'signal': answer,
      });
    } else if (type == 'answer') {
      await applyRemoteDescription(signal);
    } else if (type == 'ice-candidate') {
      await addIceCandidate(signal['candidate']);
    }
  }
}
