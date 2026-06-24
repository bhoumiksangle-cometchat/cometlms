import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import 'package:cometchat_chat_uikit/cometchat_calls_uikit.dart'
    show CallNavigationContext;

import '../providers/auth_provider.dart';

// Splash and Auth Screens
import '../../features/auth/screens/splash_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';

// Shell & Experience screens
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/courses/screens/course_details_screen.dart';
import '../../features/courses/screens/course_player_screen.dart';
import '../../features/chat/screens/messages_screen.dart';
import '../../features/notifications/screens/notifications_screen.dart';
import '../../features/ai/screens/ai_assistant_screen.dart';
import '../../features/quiz/screens/quiz_screen.dart';
import '../../features/quiz/screens/quiz_result_screen.dart';
import '../../features/instructor/screens/create_course_screen.dart';

// Admin Screens
import '../../features/admin/screens/admin_dashboard_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: CallNavigationContext.navigatorKey,
    initialLocation: '/splash',
    refreshListenable: _AuthChangeNotifier(ref),
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
        path: '/messages',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return MessagesScreen(
            user: extra?['user'] as User?,
            group: extra?['group'] as Group?,
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
      GoRoute(
        path: '/ai-assistant',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return AIAssistantScreen(
            courseId: extra?['courseId'] as String?,
            courseName: extra?['courseName'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/quiz/:id',
        builder: (context, state) {
          final quizId = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>?;
          return QuizScreen(
            quizId: quizId,
            courseId: extra?['courseId'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/quiz/:id/result',
        builder: (context, state) {
          final quizId = state.pathParameters['id']!;
          final extra = state.extra as Map<String, dynamic>?;
          return QuizResultScreen(
            quizId: quizId,
            result: (extra?['result'] as Map<String, dynamic>?) ?? {},
            courseId: extra?['courseId'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/instructor/create-course',
        builder: (context, state) => const CreateCourseScreen(),
      ),
    ],
    redirect: (context, state) {
      final authState = ref.read(authProvider);
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

/// Listenable that notifies GoRouter when auth state changes,
/// triggering re-evaluation of redirects WITHOUT recreating the GoRouter.
class _AuthChangeNotifier extends ChangeNotifier {
  _AuthChangeNotifier(this._ref) {
    _ref.listen(authProvider, (_, __) {
      notifyListeners();
    });
  }

  final Ref _ref;
}
