/// CometChat SDK configuration.
///
/// App ID, region and Auth Key are CLIENT-side credentials — they are embedded
/// in every CometChat client app by design, so shipping them here is expected.
/// The REST API Key is a SERVER secret and must NEVER appear in this file.
///
/// Defaults below keep the demo working out of the box. Override per environment:
///   flutter build apk \
///     --dart-define=COMETCHAT_APP_ID=xxx \
///     --dart-define=COMETCHAT_REGION=in \
///     --dart-define=COMETCHAT_AUTH_KEY=xxx
class CometChatConfig {
  CometChatConfig._();

  static const String appId =
      String.fromEnvironment('COMETCHAT_APP_ID', defaultValue: '168018950424c5f81');
  static const String region =
      String.fromEnvironment('COMETCHAT_REGION', defaultValue: 'in');
  static const String authKey = String.fromEnvironment(
    'COMETCHAT_AUTH_KEY',
    defaultValue: '63afb1ed8e52ebd5bc2098689e6c14713f7dccdb',
  );

  static bool get isConfigured => appId.isNotEmpty && authKey.isNotEmpty;
}
