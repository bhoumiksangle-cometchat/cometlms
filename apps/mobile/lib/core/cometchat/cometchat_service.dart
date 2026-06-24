import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart';
import 'cometchat_config.dart';

/// Singleton service for CometChat SDK initialization and auth.
///
/// Usage:
///   await CometChatService.instance.initialize(); // once at startup
///   await CometChatService.instance.loginWithAuthToken(token);
class CometChatService {
  CometChatService._();
  static final instance = CometChatService._();

  bool _initialized = false;
  bool get isInitialized => _initialized;

  /// Initialize CometChat SDK. Call once at app startup after Firebase.
  Future<void> initialize() async {
    if (_initialized) return;

    final completer = Completer<void>();

    final settings = (UIKitSettingsBuilder()
          ..appId = CometChatConfig.appId
          ..region = CometChatConfig.region
          ..authKey = CometChatConfig.authKey
          ..subscriptionType = CometChatSubscriptionType.allUsers
          ..enableCalls = true)
        .build();

    CometChatUIKit.init(
      uiKitSettings: settings,
      onSuccess: (_) {
        _initialized = true;
        debugPrint('[CometChat] Initialized successfully');
        // Explicitly init the Calls SDK after Chat SDK is ready (rule 1.1)
        CometChatUIKitCalls.init(
          CometChatConfig.appId,
          CometChatConfig.region,
          onSuccess: (_) {
            debugPrint('[CometChat Calls] Initialized successfully');
            completer.complete();
          },
          onError: (e) {
            debugPrint('[CometChat Calls] Init failed: ${e.message} — continuing without calls');
            completer.complete(); // Non-fatal — app still works without calls
          },
        );
      },
      onError: (e) {
        debugPrint('[CometChat] Init failed: ${e.message}');
        completer.completeError(e);
      },
    );

    return completer.future;
  }

  /// Login with a server-minted auth token (production flow).
  Future<User> loginWithAuthToken(String authToken) async {
    final completer = Completer<User>();

    CometChatUIKit.loginWithAuthToken(
      authToken,
      onSuccess: (user) {
        debugPrint('[CometChat] Logged in as: ${user.name}');
        completer.complete(user);
      },
      onError: (e) {
        debugPrint('[CometChat] Login failed: ${e.message}');
        completer.completeError(e);
      },
    );

    return completer.future;
  }

  /// Login with UID (dev mode only — uses auth key from UIKitSettings).
  Future<User> loginWithUid(String uid) async {
    final completer = Completer<User>();

    CometChatUIKit.login(
      uid,
      onSuccess: (user) {
        debugPrint('[CometChat] Logged in as: ${user.name}');
        completer.complete(user);
      },
      onError: (e) {
        debugPrint('[CometChat] Login failed: ${e.message}');
        completer.completeError(e);
      },
    );

    return completer.future;
  }

  /// Logout from CometChat.
  Future<void> logout() async {
    final completer = Completer<void>();

    CometChatUIKit.logout(
      onSuccess: (_) {
        debugPrint('[CometChat] Logged out');
        completer.complete();
      },
      onError: (e) {
        debugPrint('[CometChat] Logout failed: ${e.message}');
        completer.completeError(e);
      },
    );

    return completer.future;
  }

  /// Check if a user session already exists (synchronous check after init).
  User? get loggedInUser => CometChatUIKit.loggedInUser;
}
