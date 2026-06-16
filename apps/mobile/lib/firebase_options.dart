// AUTO-GENERATED FILE — Firebase configuration for CometLMS
// Generated manually from google-services.json / GoogleService-Info.plist

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyB8Sw6FQYs1mO5bKNIjd5ZIcYwtwrzXLhI',
    authDomain: 'cometlms.firebaseapp.com',
    projectId: 'cometlms',
    storageBucket: 'cometlms.firebasestorage.app',
    messagingSenderId: '475640851640',
    appId: '1:475640851640:web:1b698726d699fd0297d84d',
    measurementId: 'G-X52JNMJSF5',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAG-KRTWc-BM4Ex1k89ArAQxZI6PnAzIJg',
    appId: '1:475640851640:android:5c92b95400f6ab7a97d84d',
    messagingSenderId: '475640851640',
    projectId: 'cometlms',
    storageBucket: 'cometlms.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyB8Sw6FQYs1mO5bKNIjd5ZIcYwtwrzXLhI',
    appId: '1:475640851640:ios:cometlms',
    messagingSenderId: '475640851640',
    projectId: 'cometlms',
    storageBucket: 'cometlms.firebasestorage.app',
    iosBundleId: 'com.cometlms.app',
  );
}
