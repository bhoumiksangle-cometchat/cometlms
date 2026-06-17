import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api_client.dart';

class SocketClient {
  static final SocketClient _instance = SocketClient._internal();
  factory SocketClient() => _instance;
  SocketClient._internal();

  io.Socket? _socket;
  String? _currentToken;
  final List<void Function(String event, dynamic data)> _listeners = [];

  bool get isConnected => _socket?.connected ?? false;

  void connect(String token) {
    // If already connected with the same token, do nothing.
    if (_socket != null && _socket!.connected && _currentToken == token) {
      debugPrint('[SocketClient] Already connected with same token');
      return;
    }

    // Tear down any existing socket (stale connection or token change).
    if (_socket != null) {
      debugPrint('[SocketClient] Disposing existing socket before reconnect');
      _socket!.clearListeners();
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }

    _currentToken = token;
    final baseUrl = ApiClient.baseUrl;
    debugPrint('[SocketClient] Connecting to $baseUrl');

    // iOS's NSURLSession rejects the polling transport's HTTP upgrade handshake
    // when the server uses HTTPS — it times out even though the TLS cert is valid.
    // Android's OkHttp stack handles it fine. The fix: use websocket-only on iOS,
    // which bypasses the polling handshake entirely and connects directly.
    // On Android and other platforms, keep the standard polling→websocket upgrade
    // so the connection works behind proxies that block raw WebSocket upgrades.
    final transports = Platform.isIOS
        ? ['websocket']
        : ['polling', 'websocket'];

    _socket = io.io(
      baseUrl,
      io.OptionBuilder()
          .setTransports(transports)
          .setAuth({'token': token})
          .disableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(2000)
          .setReconnectionDelayMax(10000)
          .build(),
    );

    _wireHandlers();

    // Connect only after handlers are registered — avoids missing the first
    // 'connect' event on fast connections.
    _socket!.connect();
  }

  void disconnect() {
    if (_socket != null) {
      _socket!.clearListeners();
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
      _currentToken = null;
      debugPrint('[SocketClient] Disconnected and disposed');
    }
  }

  void emit(String event, dynamic data) {
    if (_socket == null || !_socket!.connected) {
      debugPrint('[SocketClient] Cannot emit "$event" — not connected');
      return;
    }
    _socket!.emit(event, data);
  }

  void on(String event, void Function(dynamic data) handler) {
    _socket?.on(event, handler);
  }

  void off(String event, [void Function(dynamic data)? handler]) {
    _socket?.off(event, handler);
  }

  void addGlobalListener(void Function(String event, dynamic data) listener) {
    _listeners.add(listener);
  }

  void removeGlobalListener(void Function(String event, dynamic data) listener) {
    _listeners.remove(listener);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  void _notifyListeners(String event, dynamic data) {
    for (final listener in List.of(_listeners)) {
      try {
        listener(event, data);
      } catch (e) {
        debugPrint('[SocketClient] Error in global listener for "$event": $e');
      }
    }
  }

  void _wireHandlers() {
    final socket = _socket!;

    socket.onConnect((_) {
      debugPrint('[SocketClient] Connected — id: ${socket.id}');
      _notifyListeners('connect', null);
    });

    socket.onDisconnect((reason) {
      debugPrint('[SocketClient] Disconnected: $reason');
      _notifyListeners('disconnect', reason);
    });

    socket.onConnectError((err) {
      debugPrint('[SocketClient] Connection error: $err');
      _notifyListeners('connect_error', err);
    });

    socket.onReconnect((attempt) {
      debugPrint('[SocketClient] Reconnected after $attempt attempt(s)');
      _notifyListeners('reconnect', attempt);
    });

    socket.onReconnectFailed((_) {
      debugPrint('[SocketClient] Reconnection failed — giving up');
      _notifyListeners('reconnect_failed', null);
    });

    socket.onError((err) {
      debugPrint('[SocketClient] Socket error: $err');
      _notifyListeners('error', err);
    });

    // ── Application events ────────────────────────────────────────────────
    // Event names must match exactly what socket.server.ts emits.
    const events = [
      // Presence
      'user:presence_changed',
      // Group
      'group:member_joined',
      // DM
      'dm:success',
      'dm:room',
      'dm:message',
      'dm:messages',         // batch history on dm:fetch
      'dm:notification',
      'dm:message_sent',
      'dm:error',
      // Messages — server emits 'message:sent', NOT 'message:received'
      'message:new',
      'message:sent',
      'message:error',
      // Typing — server emits 'typing:start' / 'typing:stop', not 'typing:status'
      'typing:start',
      'typing:stop',
      // Reactions & receipts
      'message:reaction_added',
      'message:reaction_removed',
      'message:reaction_updated', // kept for legacy compatibility
      'message:read',
      'message:read_updated',     // kept for legacy compatibility
      // Edits & deletes
      'message:edited',
      'message:deleted',
      // Mentions & moderation
      'user:mentioned',
      'moderation:flagged',
      // Calls
      'call:ringing',
      'call:started',
      'call:user_joined',
      'call:user_left',
      'call:ended',
      'call:invite',
      'call:accepted',
      'call:rejected',
      'call:signal',
      // Room errors
      'room:error',
      // Misc
      'pong',
    ];

    for (final event in events) {
      socket.on(event, (data) {
        debugPrint('[SocketClient] ← $event');
        _notifyListeners(event, data);
      });
    }
  }
}
