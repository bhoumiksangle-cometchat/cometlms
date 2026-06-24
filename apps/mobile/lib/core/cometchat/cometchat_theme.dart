import 'package:flutter/material.dart';
import 'package:cometchat_chat_uikit/cometchat_chat_uikit.dart';
import '../theme/app_theme.dart';

/// CometChat theme configuration matching the app's dark theme (AppColors).
///
/// CometChat Flutter V6 uses Flutter's ThemeExtension mechanism for theming.
/// The [CometChatColorPalette] is added as a ThemeExtension to the app's
/// ThemeData. CometChat widgets read it via CometChatThemeHelper.getColorPalette(context).
///
/// Per the cometchat-flutter-v6-core skill:
/// - Cache theme values in didChangeDependencies(), not build()
/// - Use CometChatThemeHelper.getColorPalette(context) for lookups
/// - Never hardcode colors inside CometChat widget configurations
/// - Set CometChatThemeMode.mode = ThemeMode.dark for dark theme

/// Creates a custom [CometChatColorPalette] that matches the LMS dark theme.
/// Wire this into your ThemeData.extensions or use [applyLmsThemeMode].
CometChatColorPalette buildLmsDarkColorPalette() {
  return CometChatColorPalette(
    // Primary — indigo accent (#6366F1)
    primary: AppColors.primary,
    extendedPrimary50: const Color(0xFF1A1A3E),
    extendedPrimary100: const Color(0xFF25254E),
    extendedPrimary200: const Color(0xFF333366),
    extendedPrimary300: const Color(0xFF44447F),
    extendedPrimary400: const Color(0xFF5555A8),
    extendedPrimary500: AppColors.primary,
    extendedPrimary600: const Color(0xFF818CF8),
    extendedPrimary700: const Color(0xFFA5B4FC),
    extendedPrimary800: const Color(0xFFC7D2FE),
    extendedPrimary900: const Color(0xFFE0E7FF),

    // Neutral scale (dark surfaces)
    neutral50: AppColors.background,      // #0F0F1A
    neutral100: AppColors.surface,        // #1A1A2E
    neutral200: AppColors.surfaceVariant, // #232340
    neutral300: AppColors.card,           // #1E1E35
    neutral400: const Color(0xFF3D3D5C),
    neutral500: AppColors.textMuted,      // #6B6B8D
    neutral600: AppColors.textSecondary,  // #A0A0C0
    neutral700: const Color(0xFFCCCCE0),
    neutral800: AppColors.textPrimary,    // #F1F1F8
    neutral900: const Color(0xFFFFFFFF),

    // Status colors
    success: AppColors.success,   // #10B981
    error: AppColors.error,       // #EF4444
    warning: AppColors.warning,   // #F59E0B
    info: AppColors.info,         // #3B82F6
  );
}

/// Apply CometChat dark theme mode.
/// Call this at app startup (after CometChat init) to set the theme mode.
void applyLmsThemeMode() {
  CometChatThemeMode.mode = ThemeMode.dark;
}

/// Returns a ThemeData with the CometChat LMS color palette wired in as
/// a ThemeExtension. Use this in your MaterialApp's darkTheme or merge
/// the extension into your existing ThemeData.
///
/// Example usage in MaterialApp:
/// ```dart
/// darkTheme: AppTheme.darkTheme.copyWith(
///   extensions: [buildLmsDarkColorPalette()],
/// ),
/// ```
ThemeData buildDarkThemeWithCometChat() {
  return AppTheme.darkTheme.copyWith(
    extensions: [
      buildLmsDarkColorPalette(),
    ],
  );
}
