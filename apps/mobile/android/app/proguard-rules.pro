# CometChat — prevent R8 from stripping SDK classes
-keep class com.cometchat.** { *; }
-keep interface com.cometchat.** { *; }
-dontwarn com.cometchat.calls.**

# WebView (required by youtube_player_iframe)
-keep class android.webkit.** { *; }
-dontwarn android.webkit.**
-keep class io.flutter.plugins.webviewflutter.** { *; }
