import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';

// Splash and Auth Screens
import '../../features/auth/screens/splash_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';

// Shell & Experience screens
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/courses/screens/course_details_screen.dart';
import '../../features/courses/screens/course_player_screen.dart';
import '../../features/chat/screens/chat_room_screen.dart';
import '../../features/calls/screens/call_screen.dart';
import '../../features/notifications/screens/notifications_screen.dart';

// Admin Screens
import '../../features/admin/screens/admin_dashboard_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/course/:id',
        builder: (context, state) {
          final courseId = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>?;
          return CourseDetailsScreen(
            courseId: courseId,
            courseData: extra?['courseData'],
          );
        },
      ),
      GoRoute(
        path: '/course/:id/player',
        builder: (context, state) {
          final courseId = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>?;
          return CoursePlayerScreen(
            courseId: courseId,
            lessonId: extra?['lessonId'],
          );
        },
      ),
      GoRoute(
        path: '/chat/:roomId',
        builder: (context, state) {
          final roomId = state.pathParameters['roomId']!;
          final extra = state.extra as Map<String, dynamic>?;
          return ChatRoomScreen(
            roomId: roomId,
            roomName: extra?['roomName'] ?? 'Chat',
            otherUserId: extra?['otherUserId'],
          );
        },
      ),
      GoRoute(
        path: '/call/:roomId',
        builder: (context, state) {
          final roomId = state.pathParameters['roomId']!;
          final extra = state.extra as Map<String, dynamic>?;
          return CallScreen(
            roomId: roomId,
            targetUserId: extra?['targetUserId'],
            callId: extra?['callId'],
            callType: extra?['callType'] ?? 'video',
            isIncoming: extra?['isIncoming'] ?? false,
          );
        },
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/admin',
        builder: (context, state) => const AdminDashboardScreen(),
      ),
    ],
    redirect: (context, state) {
      final isLoggingIn = state.matchedLocation == '/login';
      final isRegistering = state.matchedLocation == '/register';
      final isSplash = state.matchedLocation == '/splash';

      // Check current auth status
      if (authState.isLoading) {
        return null;
      }

      if (!authState.isAuthenticated && isSplash) {
        return '/login';
      }

      if (!authState.isAuthenticated) {
        // If not authenticated and trying to access a secure screen, redirect to login
        if (!isLoggingIn && !isRegistering && !isSplash) {
          return '/login';
        }
        return null;
      }

      // If authenticated and on login, register, or splash, redirect to home dashboard
      if (isLoggingIn || isRegistering || isSplash) {
        return '/';
      }

      // Role check for admin route
      if (state.matchedLocation == '/admin') {
        final isAdmin = authState.user?.isAdmin ?? false;
        if (!isAdmin) {
          return '/';
        }
      }

      return null;
    },
  );
});
