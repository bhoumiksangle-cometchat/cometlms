import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

/// Provider to fetch quiz data.
final quizProvider = FutureProvider.family<Map<String, dynamic>, String>((ref, quizId) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/quizzes/$quizId');
  final data = response.data['data'] ?? response.data;
  return data is Map<String, dynamic> ? data : {};
});

class QuizScreen extends ConsumerStatefulWidget {
  final String quizId;
  final String? courseId;

  const QuizScreen({super.key, required this.quizId, this.courseId});

  @override
  ConsumerState<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends ConsumerState<QuizScreen> {
  int _currentQuestionIndex = 0;
  final Map<int, List<int>> _answers = {}; // questionIndex -> selected option indices
  bool _isSubmitting = false;

  @override
  Widget build(BuildContext context) {
    final quizAsync = ref.watch(quizProvider(widget.quizId));

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Quiz'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
      ),
      body: quizAsync.when(
        data: (quiz) {
          final questions = quiz['questions'] as List? ?? [];
          final quizTitle = quiz['title'] ?? 'Quiz';

          if (questions.isEmpty) {
            return const Center(
              child: Text('No questions available.', style: TextStyle(color: AppColors.textSecondary)),
            );
          }

          final question = questions[_currentQuestionIndex] as Map<String, dynamic>;
          final questionText = question['text'] ?? question['question'] ?? '';
          final options = question['options'] as List? ?? [];
          final questionType = question['type'] ?? 'single'; // single, multiple, boolean
          final isLastQuestion = _currentQuestionIndex == questions.length - 1;

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Quiz title and progress
                Text(
                  quizTitle,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: (_currentQuestionIndex + 1) / questions.length,
                  backgroundColor: AppColors.borderDark,
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
                const SizedBox(height: 4),
                Text(
                  'Question ${_currentQuestionIndex + 1} of ${questions.length}',
                  style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 24),

                // Question text
                Text(
                  questionText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 24),

                // Options
                Expanded(
                  child: ListView.builder(
                    itemCount: options.length,
                    itemBuilder: (context, index) {
                      final option = options[index];
                      final optionText = option is Map ? (option['text'] ?? option.toString()) : option.toString();
                      final selectedIndices = _answers[_currentQuestionIndex] ?? [];
                      final isSelected = selectedIndices.contains(index);

                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            if (questionType == 'multiple') {
                              // Multiple choice — toggle
                              final current = _answers[_currentQuestionIndex] ?? [];
                              if (current.contains(index)) {
                                current.remove(index);
                              } else {
                                current.add(index);
                              }
                              _answers[_currentQuestionIndex] = current;
                            } else {
                              // Single choice / boolean
                              _answers[_currentQuestionIndex] = [index];
                            }
                          });
                        },
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.primary.withOpacity(0.15)
                                : AppColors.cardDark,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isSelected ? AppColors.primary : AppColors.borderDark,
                              width: isSelected ? 2 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                questionType == 'multiple'
                                    ? (isSelected ? Icons.check_box : Icons.check_box_outline_blank)
                                    : (isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked),
                                color: isSelected ? AppColors.primary : AppColors.textSecondary,
                                size: 22,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  optionText,
                                  style: TextStyle(
                                    color: isSelected ? Colors.white : Colors.white70,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // Navigation buttons
                Row(
                  children: [
                    if (_currentQuestionIndex > 0)
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            setState(() {
                              _currentQuestionIndex--;
                            });
                          },
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.borderDark),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('Previous', style: TextStyle(color: Colors.white)),
                        ),
                      ),
                    if (_currentQuestionIndex > 0) const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _isSubmitting
                            ? null
                            : () {
                                if (isLastQuestion) {
                                  _submitQuiz(questions);
                                } else {
                                  setState(() {
                                    _currentQuestionIndex++;
                                  });
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: _isSubmitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(
                                isLastQuestion ? 'Submit' : 'Next',
                                style: const TextStyle(color: Colors.white),
                              ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, s) => Center(child: Text('Error: $e', style: const TextStyle(color: AppColors.error))),
      ),
    );
  }

  Future<void> _submitQuiz(List<dynamic> questions) async {
    setState(() {
      _isSubmitting = true;
    });

    try {
      // Build answers payload
      final List<Map<String, dynamic>> answersPayload = [];
      for (int i = 0; i < questions.length; i++) {
        final question = questions[i] as Map<String, dynamic>;
        final questionId = question['id']?.toString() ?? i.toString();
        final selectedIndices = _answers[i] ?? [];
        answersPayload.add({
          'questionId': questionId,
          'selectedOptions': selectedIndices,
        });
      }

      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post(
        '/api/quizzes/${widget.quizId}/submit',
        data: {'answers': answersPayload},
      );

      final result = response.data['data'] ?? response.data;

      if (mounted) {
        context.pushReplacement('/quiz/${widget.quizId}/result', extra: {
          'result': result,
          'courseId': widget.courseId,
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit quiz: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }
}
