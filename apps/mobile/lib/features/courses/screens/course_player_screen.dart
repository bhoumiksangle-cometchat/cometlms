import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:chewie/chewie.dart';
import 'package:video_player/video_player.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

final courseDetailsProvider = FutureProvider.family<dynamic, String>((ref, courseId) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/courses/$courseId');
  return response.data['data'] ?? response.data;
});

class CoursePlayerScreen extends ConsumerStatefulWidget {
  final String courseId;
  final String? lessonId;

  const CoursePlayerScreen({
    super.key,
    required this.courseId,
    this.lessonId,
  });

  @override
  ConsumerState<CoursePlayerScreen> createState() => _CoursePlayerScreenState();
}

class _CoursePlayerScreenState extends ConsumerState<CoursePlayerScreen> {
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;
  int _activeSectionIndex = 0;
  int _activeLessonIndex = 0;
  bool _isPlayerInitialized = false;

  @override
  void dispose() {
    _videoPlayerController?.dispose();
    _chewieController?.dispose();
    super.dispose();
  }

  Future<void> _initializeVideo(String url) async {
    // Dispose previous controller
    if (_videoPlayerController != null) {
      await _videoPlayerController!.dispose();
      _chewieController?.dispose();
      setState(() {
        _isPlayerInitialized = false;
      });
    }

    // Fallback if URL is empty or invalid
    final videoUrl = url.isNotEmpty ? url : 'https://assets.mixkit.co/videos/preview/mixkit-spinning-around-the-earth-11022-large.mp4';

    _videoPlayerController = VideoPlayerController.networkUrl(Uri.parse(videoUrl));
    try {
      await _videoPlayerController!.initialize();
      _chewieController = ChewieController(
        videoPlayerController: _videoPlayerController!,
        autoPlay: true,
        looping: false,
        aspectRatio: 16 / 9,
        materialProgressColors: ChewieProgressColors(
          playedColor: AppColors.primary,
          handleColor: AppColors.primary,
          backgroundColor: Colors.grey,
          bufferedColor: Colors.white30,
        ),
      );
      setState(() {
        _isPlayerInitialized = true;
      });
    } catch (e) {
      debugPrint('[CoursePlayer] Video load error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final courseAsync = ref.watch(courseDetailsProvider(widget.courseId));

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Course Player'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
      ),
      body: courseAsync.when(
        data: (course) {
          final title = course['title'] ?? 'Untitled Course';
          final syllabus = course['syllabus'] as List? ?? [];
          
          if (syllabus.isEmpty) {
            return const Center(child: Text('No content found.', style: TextStyle(color: Colors.white)));
          }

          final activeSection = syllabus[_activeSectionIndex];
          final lessons = activeSection['lessons'] as List? ?? [];
          final activeLesson = lessons.isNotEmpty ? lessons[_activeLessonIndex] : null;

          if (activeLesson != null && !_isPlayerInitialized && _videoPlayerController == null) {
            _initializeVideo(activeLesson['videoUrl'] ?? '');
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Video Player Area
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  color: Colors.black,
                  child: _isPlayerInitialized && _chewieController != null
                      ? Chewie(controller: _chewieController!)
                      : const Center(
                          child: CircularProgressIndicator(color: AppColors.primary),
                        ),
                ),
              ),

              // Title and Lesson Meta
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      activeLesson?['title'] ?? 'Loading Lesson...',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),

              const Divider(color: AppColors.borderDark, height: 1),

              // Lessons Syllabus Index List
              Expanded(
                child: ListView.builder(
                  itemCount: syllabus.length,
                  itemBuilder: (context, sIndex) {
                    final section = syllabus[sIndex];
                    final sTitle = section['title'] ?? 'Section ${sIndex + 1}';
                    final sLessons = section['lessons'] as List? ?? [];

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                          child: Text(
                            sTitle,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        ...List.generate(sLessons.length, (lIndex) {
                          final lesson = sLessons[lIndex];
                          final lTitle = lesson['title'] ?? '';
                          final isActive = sIndex == _activeSectionIndex && lIndex == _activeLessonIndex;

                          return ListTile(
                            onTap: () {
                              setState(() {
                                _activeSectionIndex = sIndex;
                                _activeLessonIndex = lIndex;
                                _isPlayerInitialized = false;
                              });
                              _initializeVideo(lesson['videoUrl'] ?? '');
                            },
                            tileColor: isActive ? AppColors.primary.withOpacity(0.1) : Colors.transparent,
                            leading: Icon(
                              isActive ? Icons.play_circle_fill : Icons.play_circle_outline,
                              color: isActive ? AppColors.primary : AppColors.textSecondary,
                            ),
                            title: Text(
                              lTitle,
                              style: TextStyle(
                                color: isActive ? Colors.white : Colors.white70,
                                fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                          );
                        }),
                      ],
                    );
                  },
                ),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, s) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
      ),
    );
  }
}
