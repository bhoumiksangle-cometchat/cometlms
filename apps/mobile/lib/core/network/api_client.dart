import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static const String deploymentBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://cometlms-a.cometchat-staging.com',
  );

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  // Always points to production. Override at build time if needed:
  // flutter run --dart-define=API_BASE_URL=http://192.168.x.x:3000
  static String get baseUrl => deploymentBaseUrl;

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        sendTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'accessToken');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401) {
            final refreshToken = await _storage.read(key: 'refreshToken');
            if (refreshToken != null) {
              try {
                // Request refresh
                final refreshResponse = await Dio(BaseOptions(baseUrl: baseUrl)).post(
                  '/api/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );

                if (refreshResponse.statusCode == 200 || refreshResponse.statusCode == 201) {
                  final data = refreshResponse.data;
                  final newAccessToken = data['data']['accessToken'] ?? data['accessToken'];
                  final newRefreshToken = data['data']['refreshToken'] ?? data['refreshToken'];

                  if (newAccessToken != null) {
                    await _storage.write(key: 'accessToken', value: newAccessToken);
                    if (newRefreshToken != null) {
                      await _storage.write(key: 'refreshToken', value: newRefreshToken);
                    }

                    // Retry original request
                    final options = error.requestOptions;
                    options.headers['Authorization'] = 'Bearer $newAccessToken';
                    
                    final response = await _dio.fetch(options);
                    return handler.resolve(response);
                  }
                }
              } catch (e) {
                // If refresh fails, sign out
                await _storage.delete(key: 'accessToken');
                await _storage.delete(key: 'refreshToken');
              }
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  Dio get dio => _dio;

  Future<void> saveTokens(String accessToken, String refreshToken) async {
    await _storage.write(key: 'accessToken', value: accessToken);
    await _storage.write(key: 'refreshToken', value: refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: 'accessToken');
    await _storage.delete(key: 'refreshToken');
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: 'accessToken');
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: 'refreshToken');
  }

  Future<void> setToken(String? token) async {
    if (token == null) {
      _dio.options.headers.remove('Authorization');
      return;
    }
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  // Helper HTTP methods
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters, Options? options}) async {
    return await _dio.get<T>(path, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> post<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) async {
    return await _dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> put<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) async {
    return await _dio.put<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> patch<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) async {
    return await _dio.patch<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> delete<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) async {
    return await _dio.delete<T>(path, data: data, queryParameters: queryParameters, options: options);
  }
}
