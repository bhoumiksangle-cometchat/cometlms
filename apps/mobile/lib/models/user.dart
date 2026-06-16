class User {
  final String id;
  final String email;
  final String name;
  final String role; // 'STUDENT', 'INSTRUCTOR', 'ADMIN', etc.
  final String? avatarUrl;
  final bool isActive;
  final bool pushNotificationsEnabled;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.avatarUrl,
    required this.isActive,
    this.pushNotificationsEnabled = true,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? json['_id'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      role: json['role'] ?? 'STUDENT',
      avatarUrl: json['avatarUrl'] ?? json['avatar_url'],
      isActive: json['isActive'] ?? json['is_active'] ?? true,
      pushNotificationsEnabled: json['pushNotificationsEnabled'] ?? json['push_notifications_enabled'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'role': role,
      'avatarUrl': avatarUrl,
      'isActive': isActive,
      'pushNotificationsEnabled': pushNotificationsEnabled,
    };
  }

  bool get isInstructor => role == 'INSTRUCTOR';
  bool get isAdmin => role == 'ADMIN' || role == 'SUPER_ADMIN';
  bool get isStudent => role == 'STUDENT';
}
