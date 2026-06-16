import 'dart:io';

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
    final token = await _messaging.getToken();
    if (token != null) {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _registerTokenWithBackend(token, platform);
    }
  }

  /// Listen for FCM token refresh events.
  ///
  /// When the OS rotates the token, re-registers the new token with the
  /// backend automatically.
  void listenForTokenRefresh() {
    _messaging.onTokenRefresh.listen((newToken) async {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _registerTokenWithBackend(newToken, platform);
    });
  }

  /// Set up the foreground message listener.
  ///
  /// When an FCM message arrives while the app is in the foreground,
  /// displays a local notification using [flutter_local_notifications].
  void configureForegroundHandler() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final notification = message.notification;
      if (notification != null) {
        _localNotifications.show(
          notification.hashCode,
          notification.title,
          notification.body,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'default_channel',
              'Default Notifications',
              importance: Importance.high,
              priority: Priority.high,
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
  /// In both cases, navigates to the home screen.
  void configureNotificationTapHandler() {
    // App opened from terminated state via notification
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        _navigateToHome();
      }
    });

    // App in background, notification tapped
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _navigateToHome();
    });
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
