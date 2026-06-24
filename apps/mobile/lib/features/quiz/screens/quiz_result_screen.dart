import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';

class QuizResultScreen extends StatelessWidget {
  final Map<String, dynamic> result;
  final String? courseId;
  final String quizId;

  const QuizResultScreen({
    super.key,
    required this.result,
    required this.quizId,
    this.courseId,
  });

  @override
  Widget build(BuildContext context) {
    final score = (result['score'] ?? result['percentage'] ?? 0).toDouble();
    final passed = result['passed'] ?? (score >= 70);
    final totalQuestions = result['totalQuestions'] ?? 0;
    final correctAnswers = result['correctAnswers'] ?? 0;
    final breakdown = result['breakdown'] as List? ?? [];

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Quiz Result'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        automaticallyImplyLeading: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 24),

            // Score Circle
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: passed ? AppColors.success : AppColors.error,
                  width: 4,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${score.toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      color: passed ? AppColors.success : AppColors.error,
                    ),
                  ),
                  Text(
                    passed ? 'Passed!' : 'Failed',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: passed ? AppColors.success : AppColors.error,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Summary
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderDark),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStat('Correct', '$correctAnswers', AppColors.success),
                  _buildStat('Wrong', '${totalQuestions - correctAnswers}', AppColors.error),
                  _buildStat('Total', '$totalQuestions', AppColors.primary),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Breakdown (if available)
            if (breakdown.isNotEmpty) ...[
              const Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Question Breakdown',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              ...breakdown.map((item) {
                final q = item as Map<String, dynamic>;
                final isCorrect = q['correct'] ?? false;
                final questionText = q['question'] ?? q['text'] ?? '';
                final yourAnswer = q['yourAnswer'] ?? '';
                final correctAnswer = q['correctAnswer'] ?? '';

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.cardDark,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isCorrect ? AppColors.success.withOpacity(0.5) : AppColors.error.withOpacity(0.5),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isCorrect ? Icons.check_circle : Icons.cancel,
                            color: isCorrect ? AppColors.success : AppColors.error,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              questionText,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                            ),
                          ),
                        ],
                      ),
                      if (!isCorrect && correctAnswer.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Your answer: $yourAnswer',
                          style: const TextStyle(color: AppColors.error, fontSize: 12),
                        ),
                        Text(
                          'Correct: $correctAnswer',
                          style: const TextStyle(color: AppColors.success, fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                );
              }),
            ],

            const SizedBox(height: 32),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      context.pushReplacement('/quiz/$quizId', extra: {'courseId': courseId});
                    },
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Retake Quiz', style: TextStyle(color: AppColors.primary)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      if (courseId != null) {
                        context.go('/course/$courseId/player');
                      } else {
                        context.go('/');
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Back to Course', style: TextStyle(color: Colors.white)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStat(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }
}
