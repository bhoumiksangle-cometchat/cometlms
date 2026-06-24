import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/user.dart';
import '../network/api_client.dart';
import '../services/push_notification_service.dart';
import '../cometchat/cometchat_service.dart';

class AuthState {
  final User? user;
  final bool isAuthenticated;
  final bool isLoading;
  final String? errorMessage;

  AuthState({
    this.user,
    this.isAuthenticated = false,
    this.isLoading = false,
    this.errorMessage,
  });

  AuthState copyWith({
    User? user,
    bool? isAuthenticated,
    bool? isLoading,
    String? errorMessage,
  }) {
    return AuthState(
      user: user ?? this.user,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage, // We reset error unless provided
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient;
  final PushNotificationService _pushNotificationService;

  AuthNotifier(this._apiClient)
      : _pushNotificationService = PushNotificationService(apiClient: _apiClient),
        super(AuthState()) {
    tryAutoLogin();
  }

  Future<void> tryAutoLogin() async {
    state = state.copyWith(isLoading: true);
    try {
      final token = await _apiClient.getAccessToken();
      if (token != null) {
        _apiClient.setToken(token);
        
        final response = await _apiClient.get('/api/auth/me');
        final userData = response.data['data'] ?? response.data;
        final user = User.fromJson(userData);
        
        state = AuthState(user: user, isAuthenticated: true);
        
        // Initialize push notifications after successful auto-login
        await _initializePushNotifications();

        // Re-login to CometChat if session expired (uses UID in dev mode)
        // TODO: In production, fetch a fresh CometChat auth token from backend
        await _loginToCometChatWithUid(user.id);
      } else {
        state = AuthState(isAuthenticated: false);
      }
    } catch (e) {
      // Refresh might have already tried or failed
      await logout();
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await _apiClient.post('/api/auth/login', data: {
        'email': email,
        'password': password,
      });

      final success = response.data['success'] ?? true;
      if (success) {
        final payload = response.data['data'] ?? response.data;
        final userData = payload['user'];
        final tokens = payload['tokens'];
        
        final user = User.fromJson(userData);
        final accessToken = tokens['accessToken'];
        final refreshToken = tokens['refreshToken'];

        await _apiClient.saveTokens(accessToken, refreshToken);
        _apiClient.setToken(accessToken);

        state = AuthState(user: user, isAuthenticated: true);
        
        // Initialize push notifications after successful login
        await _initializePushNotifications();

        // Login to CometChat with auth token from backend
        await _loginToCometChat(payload);
        
        return true;
      } else {
        state = state.copyWith(isLoading: false, errorMessage: response.data['error'] ?? 'Login failed');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String name,
    required String role,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final response = await _apiClient.post('/api/auth/register', data: {
        'email': email,
        'password': password,
        'name': name,
        'role': role,
      });

      final success = response.data['success'] ?? true;
      if (success) {
        final payload = response.data['data'] ?? response.data;
        final userData = payload['user'];
        final tokens = payload['tokens'];
        
        final user = User.fromJson(userData);
        final accessToken = tokens['accessToken'];
        final refreshToken = tokens['refreshToken'];

        await _apiClient.saveTokens(accessToken, refreshToken);
        _apiClient.setToken(accessToken);

        state = AuthState(user: user, isAuthenticated: true);
        
        // Initialize push notifications after successful registration
        await _initializePushNotifications();

        // Login to CometChat with auth token from backend
        await _loginToCometChat(payload);
        
        return true;
      } else {
        state = state.copyWith(isLoading: false, errorMessage: response.data['error'] ?? 'Registration failed');
        return false;
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    
    // Remove device token before clearing auth credentials
    try {
      await _pushNotificationService.removeToken();
    } catch (_) {
      // Ignore errors during token removal — logout should always succeed
    }

    // Unregister push token from CometChat BEFORE logout
    try {
      await _pushNotificationService.unregisterTokenFromCometChat();
    } catch (_) {
      // Ignore errors — logout should always succeed
    }

    // Logout from CometChat
    try {
      await CometChatService.instance.logout();
    } catch (_) {
      // Ignore CometChat logout errors — main logout should always succeed
    }
    
    try {
      await _apiClient.post('/api/auth/logout');
    } catch (_) {
      // Ignore API fail during sign out
    }
    
    await _apiClient.clearTokens();
    _apiClient.setToken(null);
    
    state = AuthState();
  }

  /// Initialize push notifications after successful authentication.
  ///
  /// Requests permission, registers the FCM token with the backend,
  /// starts listening for token refresh events, and registers the
  /// token with CometChat for chat push notifications.
  Future<void> _initializePushNotifications() async {
    try {
      await _pushNotificationService.requestPermission();
      await _pushNotificationService.registerToken();
      _pushNotificationService.listenForTokenRefresh();
      _pushNotificationService.configureForegroundHandler();
      _pushNotificationService.configureNotificationTapHandler();

      // Register FCM token with CometChat for chat push notifications
      await _pushNotificationService.registerTokenWithCometChat();
    } catch (e) {
      debugPrint('🔔 [FCM] Push notification setup error: $e');
    }
  }

  /// Login to CometChat using the auth token returned from the backend login response.
  /// The backend (Task 2) returns `cometchatAuthToken` in the login payload.
  Future<void> _loginToCometChat(Map<String, dynamic> payload) async {
    try {
      // TODO: The backend login endpoint (Task 2) returns cometchatAuthToken in the response.
      // Once integrated, use: CometChatService.instance.loginWithAuthToken(token)
      final cometchatAuthToken = payload['cometchatAuthToken'] as String?;
      if (cometchatAuthToken != null && cometchatAuthToken.isNotEmpty) {
        await CometChatService.instance.loginWithAuthToken(cometchatAuthToken);
      } else {
        // Fallback: login with UID in dev mode (remove in production)
        final userId = payload['user']?['id'] as String?;
        if (userId != null) {
          await CometChatService.instance.loginWithUid(userId);
        }
      }
    } catch (e) {
      debugPrint('💬 [CometChat] Login error (non-fatal): $e');
    }
  }

  /// Login to CometChat with UID (dev mode fallback for auto-login).
  Future<void> _loginToCometChatWithUid(String uid) async {
    try {
      // Skip if already logged in
      if (CometChatService.instance.loggedInUser != null) return;
      await CometChatService.instance.loginWithUid(uid);
    } catch (e) {
      debugPrint('💬 [CometChat] Auto-login error (non-fatal): $e');
    }
  }
}

// Providers
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final apiClient = ref.read(apiClientProvider);
  return AuthNotifier(apiClient);
});
