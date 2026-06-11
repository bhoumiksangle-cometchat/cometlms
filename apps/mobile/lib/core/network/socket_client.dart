import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api_client.dart';

class SocketClient {
  static final SocketClient _instance = SocketClient._internal();
  factory SocketClient() => _instance;
  SocketClient._internal();

  io.Socket? _socket;
  final List<void Function(String event, dynamic data)> _listeners = [];

  bool get isConnected => _socket?.connected ?? false;

  void connect(String token) {
    if (_socket != null && _socket!.connected) {
      debugPrint('[SocketClient] Already connected');
      return;
    }

    final baseUrl = ApiClient.baseUrl;
    debugPrint('[SocketClient] Connecting to $baseUrl');

    _socket = io.io(baseUrl, io.OptionBuilder()
      .setTransports(['websocket', 'polling'])
      .setAuth({'token': token})
      .enableAutoConnect()
      .enableReconnection()
      .build()
    );

    _socket!.onConnect((_) {
      debugPrint('[SocketClient] Connected to server, ID: ${_socket!.id}');
      _notifyListeners('connect', null);
    });

    _socket!.onDisconnect((reason) {
      debugPrint('[SocketClient] Disconnected: $reason');
      _notifyListeners('disconnect', reason);
    });

    _socket!.onConnectError((err) {
      debugPrint('[SocketClient] Connection Error: $err');
      _notifyListeners('connect_error', err);
    });

    // Add a catch-all listener if needed, or register specific listeners.
    // In socket_io_client, we can capture events manually or register standard ones.
    _registerEventHandlers();
  }

  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket = null;
      debugPrint('[SocketClient] Disconnected manually');
    }
  }

  void emit(String event, dynamic data) {
    if (_socket == null || !_socket!.connected) {
      debugPrint('[SocketClient] Cannot emit, socket not connected: $event');
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

  void _notifyListeners(String event, dynamic data) {
    for (final listener in _listeners) {
      try {
        listener(event, data);
      } catch (e) {
        debugPrint('[SocketClient] Error in global listener: $e');
      }
    }
  }

  void _registerEventHandlers() {
    final events = [
      'user:presence_changed',
      'group:member_joined',
      'dm:success',
      'dm:room',
      'dm:message',
      'message:new',
      'message:received',
      'typing:status',
      'message:reaction_updated',
      'message:read_updated',
      'message:edited',
      'message:deleted',
      'call:started',
      'call:user_joined',
      'call:user_left',
      'call:ended',
      'call:invite',
      'call:accepted',
      'call:rejected',
      'call:signal',
    ];

    for (final event in events) {
      _socket!.on(event, (data) {
        debugPrint('[SocketClient] Received event: $event - $data');
        _notifyListeners(event, data);
      });
    }
  }
}
