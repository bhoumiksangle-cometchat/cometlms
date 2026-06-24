import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:chewie/chewie.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';
import '../providers/course_progress_provider.dart';
import '../widgets/progress_bar_widget.dart';
import '../../chat/screens/course_discussion_screen.dart';

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

class _CoursePlayerScreenState extends ConsumerState<CoursePlayerScreen>
    with SingleTickerProviderStateMixin {
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;
  YoutubePlayerController? _youtubeController;
  bool _isYouTubeVideo = false;
  int _activeSectionIndex = 0;
  int _activeLessonIndex = 0;
  bool _isPlayerInitialized = false;
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _videoPlayerController?.dispose();
    _chewieController?.dispose();
    _youtubeController?.close();
    super.dispose();
  }

  /// Extract YouTube video ID from a URL.
  String? _extractYouTubeId(String url) {
    return YoutubePlayerController.convertUrlToId(url);
  }

  Future<void> _initializeVideo(String url) async {
    // Dispose previous controllers
    if (_videoPlayerController != null) {
      await _videoPlayerController!.dispose();
      _videoPlayerController = null;
      _chewieController?.dispose();
      _chewieController = null;
    }
    if (_youtubeController != null) {
      _youtubeController!.close();
      _youtubeController = null;
    }
    setState(() {
      _isPlayerInitialized = false;
      _isYouTubeVideo = false;
    });

    // Check if it's a YouTube URL
    final youtubeId = _extractYouTubeId(url);
    if (youtubeId != null) {
      _youtubeController = YoutubePlayerController.fromVideoId(
        videoId: youtubeId,
        autoPlay: true,
        params: const YoutubePlayerParams(
          mute: false,
          showControls: true,
          showFullscreenButton: true,
          enableCaption: true,
          playsInline: true,
        ),
      );
      setState(() {
        _isYouTubeVideo = true;
        _isPlayerInitialized = true;
      });
      return;
    }

    // Fallback to regular video player for non-YouTube URLs
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

  Future<void> _markLessonComplete(String lessonId) async {
    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.post('/api/lessons/$lessonId/complete');
      ref.invalidate(courseProgressProvider(widget.courseId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lesson marked as complete!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to mark complete: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final courseAsync = ref.watch(courseDetailsProvider(widget.courseId));
    final progressAsync = ref.watch(courseProgressProvider(widget.courseId));

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Course Player'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        actions: [
          // Navigate to AI assistant with course context
          IconButton(
            icon: const Icon(Icons.psychology_outlined, color: AppColors.primary),
            tooltip: 'AI Study Copilot',
            onPressed: () {
              final course = courseAsync.valueOrNull;
              final courseName = course?['title'] as String? ?? '';
              context.push('/ai-assistant', extra: {
                'courseId': widget.courseId,
                'courseName': courseName,
              });
            },
          ),
        ],
      ),
      body: courseAsync.when(
        data: (course) {
          final title = course['title'] ?? 'Untitled Course';
          final syllabus = course['sections'] as List? ?? [];
          
          if (syllabus.isEmpty) {
            return const Center(child: Text('No content found.', style: TextStyle(color: Colors.white)));
          }

          final activeSection = syllabus[_activeSectionIndex];
          final lessons = activeSection['lessons'] as List? ?? [];
          final activeLesson = lessons.isNotEmpty ? lessons[_activeLessonIndex] : null;

          if (activeLesson != null && !_isPlayerInitialized && _videoPlayerController == null && _youtubeController == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _initializeVideo(activeLesson['videoUrl'] ?? '');
            });
          }

          // Get completed lesson IDs from progress
          final completedLessonIds = progressAsync.valueOrNull?.completedLessonIds ?? [];

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Video Player Area
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Container(
                  color: Colors.black,
                  child: _isPlayerInitialized && _isYouTubeVideo && _youtubeController != null
                      ? YoutubePlayer(
                          controller: _youtubeController!,
                          aspectRatio: 16 / 9,
                        )
                      : _isPlayerInitialized && _chewieController != null
                          ? Chewie(controller: _chewieController!)
                          : _isPlayerInitialized
                              ? const Center(
                                  child: Text('Unable to load video',
                                      style: TextStyle(color: Colors.white70)),
                                )
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

              // Progress Bar
              progressAsync.when(
                data: (progress) => CourseProgressBar(
                  progressPercentage: progress.progressPercentage,
                  completedLessons: progress.completedLessons,
                  totalLessons: progress.totalLessons,
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),

              const Divider(color: AppColors.borderDark, height: 1),

              // Tabs: Content, Discussion & Q&A
              TabBar(
                controller: _tabController,
                indicatorColor: AppColors.primary,
                labelColor: Colors.white,
                unselectedLabelColor: AppColors.textSecondary,
                tabs: const [
                  Tab(text: 'Content'),
                  Tab(text: 'Discussion'),
                  Tab(text: 'Q&A'),
                ],
              ),

              Expanded(
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Content tab — Lessons Syllabus
                    ListView.builder(
                      itemCount: syllabus.length,
                      itemBuilder: (context, sIndex) {
                        final section = syllabus[sIndex];
                        final sTitle = section['title'] ?? 'Section ${sIndex + 1}';
                        final sLessons = section['lessons'] as List? ?? [];
                        final sectionQuiz = section['quiz'];

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
                              final lessonId = lesson['id']?.toString() ?? '';
                              final isActive = sIndex == _activeSectionIndex && lIndex == _activeLessonIndex;
                              final isCompleted = completedLessonIds.contains(lessonId);

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
                                  isCompleted
                                      ? Icons.check_circle
                                      : isActive
                                          ? Icons.play_circle_fill
                                          : Icons.play_circle_outline,
                                  color: isCompleted
                                      ? AppColors.success
                                      : isActive
                                          ? AppColors.primary
                                          : AppColors.textSecondary,
                                ),
                                title: Text(
                                  lTitle,
                                  style: TextStyle(
                                    color: isActive ? Colors.white : Colors.white70,
                                    fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                                trailing: isActive && !isCompleted
                                    ? TextButton(
                                        onPressed: () => _markLessonComplete(lessonId),
                                        child: const Text(
                                          'Mark Complete',
                                          style: TextStyle(color: AppColors.primary, fontSize: 12),
                                        ),
                                      )
                                    : null,
                              );
                            }),
                            // Quiz button for section
                            if (sectionQuiz != null)
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                child: OutlinedButton.icon(
                                  onPressed: () {
                                    final quizId = sectionQuiz['id']?.toString() ?? '';
                                    context.push('/quiz/$quizId', extra: {'courseId': widget.courseId});
                                  },
                                  icon: const Icon(Icons.quiz_outlined, color: AppColors.primary),
                                  label: const Text('Take Quiz', style: TextStyle(color: AppColors.primary)),
                                  style: OutlinedButton.styleFrom(
                                    side: const BorderSide(color: AppColors.primary),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        );
                      },
                    ),

                    // Discussion tab — CometChat group
                    CourseDiscussionWidget(groupId: 'course-${widget.courseId}'),

                    // Q&A tab — Same group with guidance banner
                    Column(
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.info.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.info.withOpacity(0.3)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.info_outline, color: AppColors.info, size: 18),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Ask questions below. Use Reply in Thread to keep Q&A organized.',
                                  style: TextStyle(color: AppColors.info, fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: CourseDiscussionWidget(groupId: 'course-${widget.courseId}'),
                        ),
                      ],
                    ),
                  ],
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
