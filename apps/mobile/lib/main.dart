import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/cometchat/cometchat_service.dart';
import 'core/cometchat/cometchat_theme.dart';
import 'firebase_options.dart';

/// Top-level background message handler for FCM.
/// Must be a top-level function (not a class method) as required by Firebase.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Handle CometChat call notifications in the background
  final data = message.data;
  final type = data['type'] ?? '';

  if (type == 'call') {
    // Show a high-priority notification for incoming calls
    final FlutterLocalNotificationsPlugin localNotifications =
        FlutterLocalNotificationsPlugin();

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: androidSettings);
    await localNotifications.initialize(settings);

    const callChannel = AndroidNotificationChannel(
      'call_channel',
      'Incoming Calls',
      description: 'Notifications for incoming voice and video calls',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
    );

    await localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(callChannel);

    final callerName = data['senderName'] ?? data['title'] ?? 'Incoming call';
    final callType = data['callType'] ?? 'video';
    final body = callType == 'audio'
        ? 'Incoming voice call'
        : 'Incoming video call';

    await localNotifications.show(
      message.hashCode,
      callerName,
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
      ),
    );
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    debugPrint('🔥 [Firebase] Initialized successfully');
    // Register background message handler only if Firebase initialized
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('[Firebase] Initialization failed: $e');
    // App continues without push notifications
  }

  // Initialize CometChat SDK (must complete before any login or component usage)
  try {
    await CometChatService.instance.initialize();
    applyLmsThemeMode(); // Set CometChat to dark mode
    debugPrint('💬 [CometChat] Initialized successfully');
  } catch (e) {
    debugPrint('[CometChat] Initialization failed: $e');
    // App continues without chat — non-fatal
  }

  runApp(const ProviderScope(child: SmartPDSApp()));
}

class SmartPDSApp extends ConsumerWidget {
  const SmartPDSApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'SmartPDS',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: buildDarkThemeWithCometChat(),
      themeMode: ThemeMode.dark,
      routerConfig: router,
    );
  }
}
