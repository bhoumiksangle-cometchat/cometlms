import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/user.dart';
import '../network/api_client.dart';
import '../network/socket_client.dart';
import '../services/push_notification_service.dart';

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
  final SocketClient _socketClient;
  final PushNotificationService _pushNotificationService;

  AuthNotifier(this._apiClient, this._socketClient)
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
        
        _socketClient.connect(token);
        
        state = AuthState(user: user, isAuthenticated: true);
        
        // Initialize push notifications after successful auto-login
        await _initializePushNotifications();
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
        _socketClient.connect(accessToken);

        state = AuthState(user: user, isAuthenticated: true);
        
        // Initialize push notifications after successful login
        await _initializePushNotifications();
        
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
        _socketClient.connect(accessToken);

        state = AuthState(user: user, isAuthenticated: true);
        
        // Initialize push notifications after successful registration
        await _initializePushNotifications();
        
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
    
    try {
      await _apiClient.post('/api/auth/logout');
    } catch (_) {
      // Ignore API fail during sign out
    }
    
    await _apiClient.clearTokens();
    _apiClient.setToken(null);
    _socketClient.disconnect();
    
    state = AuthState();
  }

  /// Initialize push notifications after successful authentication.
  ///
  /// Requests permission, registers the FCM token with the backend,
  /// and starts listening for token refresh events.
  Future<void> _initializePushNotifications() async {
    try {
      await _pushNotificationService.requestPermission();
      await _pushNotificationService.registerToken();
      _pushNotificationService.listenForTokenRefresh();
      _pushNotificationService.configureForegroundHandler();
      _pushNotificationService.configureNotificationTapHandler();
    } catch (e) {
      debugPrint('🔔 [FCM] Push notification setup error: $e');
    }
  }
}

// Providers
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

final socketClientProvider = Provider<SocketClient>((ref) {
  return SocketClient();
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final apiClient = ref.read(apiClientProvider);
  final socketClient = ref.read(socketClientProvider);
  return AuthNotifier(apiClient, socketClient);
});
