import 'dart:io';

import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';

import '../network/api_client.dart';

/// Top-level background message handler.
///
/// Must be a top-level function (not a class method) as required by Firebase.
/// Background messages on Android are automatically displayed by the system tray;
/// iOS may need additional handling if custom display is required.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Background messages are automatically displayed by FCM on Android.
  // iOS will display them via the APNs integration.
}

/// Instance of [FlutterLocalNotificationsPlugin] used to display notifications
/// when the app is in the foreground.
final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

/// Service responsible for managing push notifications via Firebase Cloud Messaging.
///
/// Handles initialization, permission requests, token registration with
/// the backend API, token refresh listening, foreground/background message
/// handling, and notification tap navigation.
class PushNotificationService {
  final ApiClient _apiClient;
  final FirebaseMessaging _messaging;

  /// A [GlobalKey] for the app's [NavigatorState], used to navigate
  /// to the home screen when a notification is tapped.
  final GlobalKey<NavigatorState>? navigatorKey;

  /// A [GoRouter] instance used for navigation on notification tap.
  final GoRouter? router;

  PushNotificationService({
    required ApiClient apiClient,
    FirebaseMessaging? messaging,
    this.navigatorKey,
    this.router,
  })  : _apiClient = apiClient,
        _messaging = messaging ?? FirebaseMessaging.instance;

  /// Initialize Firebase and set up local notifications.
  ///
  /// Should be called once during app startup before any other Firebase
  /// services are used.
  Future<void> initialize() async {
    await Firebase.initializeApp();
    await _initLocalNotifications();

    // Register the background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }

  /// Initialize flutter_local_notifications for foreground display.
  Future<void> _initLocalNotifications() async {
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // Create the Android notification channel for high-importance messages
    const channel = AndroidNotificationChannel(
      'default_channel',
      'Default Notifications',
      description: 'Default notification channel for push notifications',
      importance: Importance.high,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    // Create a dedicated call channel with max importance
    const callChannel = AndroidNotificationChannel(
      'call_channel',
      'Incoming Calls',
      description: 'Notifications for incoming voice and video calls',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
    );
    await _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(callChannel);
  }

  /// Called when a local notification is tapped by the user.
  void _onNotificationTapped(NotificationResponse response) {
    _navigateToHome();
  }

  /// Request notification permission from the operating system.
  ///
  /// Returns `true` if the user granted permission, `false` otherwise.
  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized;
  }

  /// Get the current FCM token and register it with the backend API.
  ///
  /// Posts the token to `/api/notifications/device-token` with the
  /// appropriate platform identifier ('android' or 'ios').
  Future<void> registerToken() async {
    try {
      debugPrint('🔔 [FCM] Requesting token...');
      final token = await _messaging.getToken();
      debugPrint('🔔 [FCM] Token result: $token');
      if (token != null) {
        debugPrint('🔔 FCM TOKEN: $token');
        final platform = Platform.isIOS ? 'ios' : 'android';
        await _registerTokenWithBackend(token, platform);
      } else {
        debugPrint('🔔 [FCM] Token is null — checking notification permission...');
        final settings = await _messaging.getNotificationSettings();
        debugPrint('🔔 [FCM] Auth status: ${settings.authorizationStatus}');
      }
    } catch (e, stack) {
      debugPrint('🔔 [FCM] Error getting token: $e');
      debugPrint('🔔 [FCM] Stack: $stack');
    }
  }

  /// Listen for FCM token refresh events.
  ///
  /// When the OS rotates the token, re-registers the new token with the
  /// backend automatically and updates CometChat registration.
  void listenForTokenRefresh() {
    _messaging.onTokenRefresh.listen((newToken) async {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _registerTokenWithBackend(newToken, platform);

      // Also re-register with CometChat on token refresh
      await registerTokenWithCometChat();
    });
  }

  /// Register the FCM/APNs token with CometChat so offline users receive
  /// push notifications for new messages, mentions, and incoming calls.
  Future<void> registerTokenWithCometChat() async {
    try {
      final token = await _messaging.getToken();
      if (token == null) {
        debugPrint('🔔 [CometChat Push] No FCM token available');
        return;
      }

      debugPrint('🔔 [CometChat Push] Registering token with CometChat...');
      debugPrint('🔔 [CometChat Push] Platform: ${Platform.isAndroid ? "Android" : "iOS"}');
      debugPrint('🔔 [CometChat Push] Token: ${token.substring(0, 20)}...');

      if (Platform.isAndroid) {
        await CometChatNotifications.registerPushToken(
          PushPlatforms.FCM_FLUTTER_ANDROID,
          fcmToken: token,
          providerId: 'fcm-provider',
          onSuccess: (response) {
            debugPrint('🔔 [CometChat Push] Token registered successfully: $response');
          },
          onError: (e) {
            debugPrint('🔔 [CometChat Push] Registration FAILED: ${e.code} - ${e.message}');
          },
        );
      } else if (Platform.isIOS) {
        final apnsToken = await _messaging.getAPNSToken();
        if (apnsToken != null) {
          await CometChatNotifications.registerPushToken(
            PushPlatforms.APNS_FLUTTER_DEVICE,
            deviceToken: apnsToken,
            providerId: 'apns-provider',
            onSuccess: (response) {
              debugPrint('🔔 [CometChat Push] APNs token registered: $response');
            },
            onError: (e) {
              debugPrint('🔔 [CometChat Push] APNs registration FAILED: ${e.code} - ${e.message}');
            },
          );
        } else {
          debugPrint('🔔 [CometChat Push] No APNs token available');
        }
      }
    } catch (e) {
      debugPrint('🔔 [CometChat Push] Token registration exception: $e');
    }
  }

  /// Unregister push token from CometChat before logout.
  Future<void> unregisterTokenFromCometChat() async {
    try {
      await CometChatNotifications.unregisterPushToken();
      debugPrint('🔔 [CometChat Push] Token unregistered');
    } catch (e) {
      debugPrint('🔔 [CometChat Push] Token unregister failed: $e');
    }
  }

  /// Set up the foreground message listener.
  ///
  /// When an FCM message arrives while the app is in the foreground,
  /// displays a local notification using [flutter_local_notifications].
  /// Detects CometChat push notifications and formats them appropriately.
  void configureForegroundHandler() {
    // On Android, FCM does NOT show a heads-up notification when the app is
    // in the foreground — must display manually via flutter_local_notifications.
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('🔔 [FCM] Foreground message: ${message.notification?.title} / ${message.notification?.body}');
      debugPrint('🔔 [FCM] Data: ${message.data}');

      final data = message.data;

      // Check if this is a CometChat push notification
      final isCometChatMessage = data.containsKey('type') &&
          (data['type'] == 'chat' || data['type'] == 'call');
      final isCallNotification = data['type'] == 'call';

      String title;
      String body;

      if (isCometChatMessage) {
        title = data['title'] ?? data['senderName'] ?? message.notification?.title ?? 'New message';
        body = data['body'] ?? message.notification?.body ?? '';
      } else {
        title = message.notification?.title ?? data['title'] ?? 'New notification';
        body = message.notification?.body ?? data['body'] ?? '';
      }

      // Use call channel with max priority for incoming calls
      if (isCallNotification) {
        final callType = data['callType'] ?? 'video';
        body = callType == 'audio' ? 'Incoming voice call' : 'Incoming video call';

        _localNotifications.show(
          message.hashCode,
          title,
          body,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'call_channel',
              'Incoming Calls',
              importance: Importance.max,
              priority: Priority.max,
              category: AndroidNotificationCategory.call,
              fullScreenIntent: true,
              ongoing: true,
              autoCancel: false,
              visibility: NotificationVisibility.public,
              playSound: true,
              enableVibration: true,
            ),
            iOS: DarwinNotificationDetails(
              presentAlert: true,
              presentSound: true,
              interruptionLevel: InterruptionLevel.timeSensitive,
            ),
          ),
        );
      } else {
        _localNotifications.show(
          message.hashCode,
          title,
          body,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'default_channel',
              'Default Notifications',
              importance: Importance.max,
              priority: Priority.high,
              showWhen: true,
            ),
            iOS: DarwinNotificationDetails(),
          ),
        );
      }
    });
  }

  /// Configure handlers for notification taps.
  ///
  /// Handles two scenarios:
  /// 1. App was terminated and opened via notification tap.
  /// 2. App was in background and notification was tapped.
  ///
  /// For CometChat push notifications, navigates to the relevant chat screen.
  /// Otherwise navigates to the home screen.
  void configureNotificationTapHandler() {
    // App opened from terminated state via notification
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        _handleNotificationNavigation(message);
      }
    });

    // App in background, notification tapped
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleNotificationNavigation(message);
    });
  }

  /// Route to the appropriate screen based on notification data.
  ///
  /// CometChat push data includes `receiverType` (user/group) and
  /// `receiver` (uid/guid). Routes to the corresponding chat screen.
  void _handleNotificationNavigation(RemoteMessage message) async {
    final data = message.data;
    final receiverType = data['receiverType'];
    final receiver = data['receiver'];

    if (receiverType == 'user' && receiver != null) {
      // Resolve the full CometChat User object before navigating
      try {
        CometChat.getUser(
          receiver,
          onSuccess: (user) {
            router?.push('/messages', extra: {'user': user});
          },
          onError: (_) {
            // Fallback: create a minimal user object
            final user = User(uid: receiver, name: receiver);
            router?.push('/messages', extra: {'user': user});
          },
        );
      } catch (_) {
        final user = User(uid: receiver, name: receiver);
        router?.push('/messages', extra: {'user': user});
      }
    } else if (receiverType == 'group' && receiver != null) {
      // Resolve the full CometChat Group object before navigating
      try {
        CometChat.getGroup(
          receiver,
          onSuccess: (group) {
            router?.push('/messages', extra: {'group': group});
          },
          onError: (_) {
            _navigateToHome();
          },
        );
      } catch (_) {
        _navigateToHome();
      }
    } else {
      _navigateToHome();
    }
  }

  /// Navigate to the home screen (route '/').
  void _navigateToHome() {
    if (router != null) {
      router!.go('/');
    } else if (navigatorKey?.currentState != null) {
      navigatorKey!.currentState!.pushNamedAndRemoveUntil('/', (_) => false);
    }
  }

  /// Remove the device token from the backend.
  ///
  /// Should be called during logout to stop receiving push notifications.
  Future<void> removeToken() async {
    await _apiClient.delete('/api/notifications/device-token');
  }

  /// Sends the FCM token to the backend for storage.
  Future<void> _registerTokenWithBackend(String token, String platform) async {
    await _apiClient.post(
      '/api/notifications/device-token',
      data: {
        'token': token,
        'platform': platform,
      },
    );
  }
}
