import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'socket_client.dart';
import 'api_client.dart';

class WebRTCService {
  static final WebRTCService instance = WebRTCService._();
  WebRTCService._();

  RTCPeerConnection? peerConnection;
  MediaStream? localStream;
  final RTCVideoRenderer localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer remoteRenderer = RTCVideoRenderer();
  String? targetUserId;
  String? callId;

  // Buffer ICE candidates that arrive before the remote description is set.
  final List<RTCIceCandidate> _pendingCandidates = [];
  bool _remoteDescriptionSet = false;
  bool _initialized = false;
  bool _renderersReady = false;

  void configureCall({String? targetUserId, String? callId}) {
    this.targetUserId = targetUserId;
    this.callId = callId;
  }

  /// Fetch ICE servers (STUN + optional TURN) from the backend. Falls back to
  /// Google STUN if the request fails so same-network calls still work.
  Future<List<Map<String, dynamic>>> _fetchIceServers() async {
    const fallback = [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
    ];
    try {
      // Use the shared singleton ApiClient so the auth token is always present.
      final apiClient = ApiClient();
      final res = await apiClient.get('/api/calls/ice-servers');
      final data = res.data is Map ? res.data['data'] : null;
      final servers = data is Map ? data['iceServers'] : null;
      if (servers is List && servers.isNotEmpty) {
        return servers
            .map<Map<String, dynamic>>((s) => Map<String, dynamic>.from(s as Map))
            .toList();
      }
    } catch (e) {
      debugPrint('[WebRTC] Failed to fetch ICE servers, using STUN fallback: $e');
    }
    return fallback;
  }

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    _remoteDescriptionSet = false;
    _pendingCandidates.clear();

    // Renderers are reused across calls — only initialize them once for the
    // lifetime of the singleton. Disposing + reinitializing them causes
    // "RTCVideoRenderer is disposed" errors on the second call.
    if (!_renderersReady) {
      await localRenderer.initialize();
      await remoteRenderer.initialize();
      _renderersReady = true;
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': true,
    });

    final iceServers = await _fetchIceServers();
    peerConnection = await createPeerConnection({'iceServers': iceServers});

    peerConnection!.onIceCandidate = (candidate) {
      SocketClient().emit('call:signal', {
        'targetUserId': targetUserId,
        'callId': callId,
        'signal': {
          'type': 'ice',
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
    // Stop listening so a re-entered call screen gets fresh handlers.
    SocketClient().off('call:signal');
    SocketClient().off('call:accepted');
    _pendingCandidates.clear();
    _remoteDescriptionSet = false;
    _initialized = false;
    // Clear video surfaces but DO NOT dispose the renderers — they are reused
    // across calls (the singleton lives for the app lifetime).
    try {
      localRenderer.srcObject = null;
    } catch (_) {}
    try {
      remoteRenderer.srcObject = null;
    } catch (_) {}
    await localStream?.dispose();
    await peerConnection?.close();
    peerConnection = null;
    localStream = null;
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
    _remoteDescriptionSet = true;
    // Flush any ICE candidates that arrived before the remote description.
    for (final c in _pendingCandidates) {
      await peerConnection!.addCandidate(c);
    }
    _pendingCandidates.clear();
  }

  Future<Map<String, dynamic>> createAnswer() async {
    final answer = await peerConnection!.createAnswer();
    await peerConnection!.setLocalDescription(answer);
    return answer.toMap();
  }

  Future<void> addIceCandidate(Map<String, dynamic> candidateData) async {
    final candidate = RTCIceCandidate(
      candidateData['candidate'],
      candidateData['sdpMid'],
      candidateData['sdpMLineIndex'],
    );
    if (_remoteDescriptionSet) {
      await peerConnection?.addCandidate(candidate);
    } else {
      _pendingCandidates.add(candidate);
    }
  }

  void handleSignal(dynamic signal) async {
    if (signal == null || peerConnection == null) return;

    final type = signal['type'];

    if (type == 'offer') {
      await applyRemoteDescription(Map<String, dynamic>.from(signal as Map));
      final answer = await createAnswer();
      SocketClient().emit('call:signal', {
        'targetUserId': targetUserId,
        'callId': callId,
        'signal': answer,
      });
    } else if (type == 'answer') {
      await applyRemoteDescription(Map<String, dynamic>.from(signal as Map));
    } else if (type == 'ice' || type == 'ice-candidate') {
      final cand = signal['candidate'];
      if (cand is Map) {
        await addIceCandidate(Map<String, dynamic>.from(cand));
      }
    }
  }

  /// Mute/unmute the local microphone. Returns the new muted state.
  bool toggleMute() {
    final tracks = localStream?.getAudioTracks() ?? [];
    if (tracks.isEmpty) return false;
    final enabled = tracks.first.enabled;
    for (final t in tracks) {
      t.enabled = !enabled;
    }
    return enabled; // returns previous enabled = now muted
  }

  /// Enable/disable the local camera. Returns the new camera-off state.
  bool toggleCamera() {
    final tracks = localStream?.getVideoTracks() ?? [];
    if (tracks.isEmpty) return false;
    final enabled = tracks.first.enabled;
    for (final t in tracks) {
      t.enabled = !enabled;
    }
    return enabled; // returns previous enabled = now camera off
  }
}
