import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/auth_provider.dart';

/// Provider to fetch categories for the course form.
final categoriesProvider = FutureProvider<List<dynamic>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/api/categories');
  final data = response.data['data'] ?? response.data;
  return data is List ? data : [];
});

class CreateCourseScreen extends ConsumerStatefulWidget {
  const CreateCourseScreen({super.key});

  @override
  ConsumerState<CreateCourseScreen> createState() => _CreateCourseScreenState();
}

class _CreateCourseScreenState extends ConsumerState<CreateCourseScreen> {
  int _currentStep = 0;
  bool _isSaving = false;
  late final PageController _pageController;

  // Step 1: Info
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _thumbnailUrlController = TextEditingController();
  String? _selectedCategory;

  // Step 2: Curriculum
  final List<Map<String, dynamic>> _sections = [];

  // Step 3: Pricing
  final _priceController = TextEditingController(text: '0');
  String _currency = 'USD';

  static const _stepLabels = ['Info', 'Curriculum', 'Pricing', 'Review'];

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    _titleController.dispose();
    _descriptionController.dispose();
    _thumbnailUrlController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  String _generateSlug(String title) {
    return title
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-|-$'), '');
  }

  void _goToStep(int step) {
    if (step < 0 || step > 3) return;
    setState(() => _currentStep = step);
    _pageController.animateToPage(
      step,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Create Course'),
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Step indicator
          _buildStepIndicator(),
          const SizedBox(height: 8),
          // Page content
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              onPageChanged: (index) => setState(() => _currentStep = index),
              children: [
                _buildInfoStep(),
                _buildCurriculumStep(),
                _buildPricingStep(),
                _buildReviewStep(),
              ],
            ),
          ),
          // Bottom navigation buttons
          _buildBottomButtons(),
        ],
      ),
    );
  }

  Widget _buildStepIndicator() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: List.generate(_stepLabels.length, (index) {
          final isActive = index == _currentStep;
          final isCompleted = index < _currentStep;
          return Expanded(
            child: Row(
              children: [
                if (index > 0)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: isCompleted || isActive
                          ? AppColors.primary
                          : AppColors.borderDark,
                    ),
                  ),
                GestureDetector(
                  onTap: isCompleted ? () => _goToStep(index) : null,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isActive
                              ? AppColors.primary
                              : isCompleted
                                  ? AppColors.success
                                  : AppColors.surfaceVariant,
                          border: Border.all(
                            color: isActive
                                ? AppColors.primary
                                : isCompleted
                                    ? AppColors.success
                                    : AppColors.borderDark,
                            width: 2,
                          ),
                        ),
                        child: Center(
                          child: isCompleted
                              ? const Icon(Icons.check, size: 14, color: Colors.white)
                              : Text(
                                  '${index + 1}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isActive ? Colors.white : AppColors.textMuted,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _stepLabels[index],
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                          color: isActive
                              ? AppColors.primary
                              : isCompleted
                                  ? AppColors.success
                                  : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (index < _stepLabels.length - 1 && index == 0)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: _currentStep > index
                          ? AppColors.primary
                          : AppColors.borderDark,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buildBottomButtons() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: AppColors.cardDark,
        border: Border(top: BorderSide(color: AppColors.borderDark)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (_currentStep > 0)
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _goToStep(_currentStep - 1),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.borderDark),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Back', style: TextStyle(color: Colors.white)),
                ),
              ),
            if (_currentStep > 0) const SizedBox(width: 12),
            if (_currentStep < 3)
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: () => _goToStep(_currentStep + 1),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Next', style: TextStyle(color: Colors.white)),
                ),
              ),
            if (_currentStep == 3) ...[
              Expanded(
                child: OutlinedButton(
                  onPressed: _isSaving ? null : () => _saveCourse(publish: false),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.borderDark),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Draft', style: TextStyle(color: Colors.white)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : () => _saveCourse(publish: true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isSaving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Publish', style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoStep() {
    final categoriesAsync = ref.watch(categoriesProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Course Information',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Fill in the basic details about your course.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),
          _buildLabel('Course Title', required: true),
          const SizedBox(height: 8),
          TextField(
            controller: _titleController,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              hintText: 'e.g. Introduction to Rust Programming',
            ),
          ),
          const SizedBox(height: 20),
          _buildLabel('Description'),
          const SizedBox(height: 8),
          TextField(
            controller: _descriptionController,
            style: const TextStyle(color: Colors.white),
            maxLines: 5,
            decoration: const InputDecoration(
              hintText: 'What will students learn in this course?',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          _buildLabel('Category'),
          const SizedBox(height: 8),
          categoriesAsync.when(
            data: (categories) {
              return DropdownButtonFormField<String>(
                value: _selectedCategory,
                dropdownColor: AppColors.cardDark,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Select a category',
                ),
                items: categories.map<DropdownMenuItem<String>>((cat) {
                  final name = cat is Map
                      ? (cat['name']?.toString() ?? cat.toString())
                      : cat.toString();
                  final id = cat is Map
                      ? (cat['id']?.toString() ?? name)
                      : name;
                  return DropdownMenuItem<String>(
                    value: id,
                    child: Text(name),
                  );
                }).toList(),
                onChanged: (value) => setState(() => _selectedCategory = value),
              );
            },
            loading: () => const LinearProgressIndicator(color: AppColors.primary),
            error: (_, __) => const Text(
              'Failed to load categories',
              style: TextStyle(color: AppColors.error),
            ),
          ),
          const SizedBox(height: 20),
          _buildLabel('Thumbnail URL'),
          const SizedBox(height: 8),
          TextField(
            controller: _thumbnailUrlController,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              hintText: 'https://example.com/image.jpg',
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildCurriculumStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Curriculum',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Organize your course into sections and lessons.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),
          if (_sections.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderDark),
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.library_books_outlined,
                    size: 48,
                    color: AppColors.textMuted,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'No sections yet',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Add sections to organize your course content.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ..._sections.asMap().entries.map((entry) {
            final sIndex = entry.key;
            final section = entry.value;
            final lessons =
                section['lessons'] as List<Map<String, dynamic>>? ?? [];

            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderDark),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Section header
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Center(
                            child: Text(
                              '${sIndex + 1}',
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            section['title'] ?? 'Section ${sIndex + 1}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline,
                              color: AppColors.error, size: 20),
                          onPressed: () =>
                              setState(() => _sections.removeAt(sIndex)),
                          tooltip: 'Remove section',
                        ),
                      ],
                    ),
                  ),
                  if (lessons.isNotEmpty)
                    const Divider(
                        color: AppColors.borderDark, height: 1, indent: 16),
                  // Lessons
                  ...lessons.asMap().entries.map((lEntry) {
                    final lesson = lEntry.value;
                    return Padding(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      child: Row(
                        children: [
                          const Icon(Icons.play_circle_outline,
                              size: 18, color: AppColors.textSecondary),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              lesson['title'] ?? 'Untitled Lesson',
                              style: const TextStyle(
                                  color: Colors.white70, fontSize: 14),
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              setState(() => lessons.removeAt(lEntry.key));
                            },
                            child: const Icon(Icons.close,
                                size: 16, color: AppColors.textMuted),
                          ),
                        ],
                      ),
                    );
                  }),
                  // Add lesson button
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    child: GestureDetector(
                      onTap: () => _showAddLessonDialog(sIndex),
                      child: Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                  color: AppColors.primary.withValues(alpha: 0.5)),
                            ),
                            child: const Icon(Icons.add,
                                size: 14, color: AppColors.primary),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Add Lesson',
                            style: TextStyle(
                                color: AppColors.primary, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _showAddSectionDialog,
              icon: const Icon(Icons.add, color: AppColors.primary, size: 20),
              label: const Text('Add Section',
                  style: TextStyle(color: AppColors.primary)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildPricingStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Pricing',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Set the price for your course. Use 0 for free courses.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),
          _buildLabel('Price'),
          const SizedBox(height: 8),
          TextField(
            controller: _priceController,
            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              prefixText: '\$ ',
              prefixStyle: TextStyle(color: AppColors.primary, fontSize: 24, fontWeight: FontWeight.bold),
              hintText: '0.00',
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Set to 0 for free courses',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 24),
          _buildLabel('Currency'),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: _currency,
            dropdownColor: AppColors.cardDark,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(),
            items: const [
              DropdownMenuItem(value: 'USD', child: Text('USD — US Dollar')),
              DropdownMenuItem(value: 'EUR', child: Text('EUR — Euro')),
              DropdownMenuItem(value: 'GBP', child: Text('GBP — British Pound')),
              DropdownMenuItem(value: 'INR', child: Text('INR — Indian Rupee')),
            ],
            onChanged: (value) => setState(() => _currency = value ?? 'USD'),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildReviewStep() {
    final price = double.tryParse(_priceController.text) ?? 0;
    final totalLessons = _sections.fold<int>(
        0, (sum, s) => sum + ((s['lessons'] as List?)?.length ?? 0));

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Review & Publish',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Review your course details before publishing.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),

          // Summary card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.cardDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderDark),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _reviewItem(Icons.book_outlined, 'Title',
                    _titleController.text.isEmpty ? '(not set)' : _titleController.text),
                const Divider(color: AppColors.borderDark, height: 24),
                _reviewItem(Icons.link_outlined, 'Slug',
                    _generateSlug(_titleController.text).isEmpty ? '—' : _generateSlug(_titleController.text)),
                const Divider(color: AppColors.borderDark, height: 24),
                _reviewItem(Icons.category_outlined, 'Category',
                    _selectedCategory ?? '(none)'),
                const Divider(color: AppColors.borderDark, height: 24),
                _reviewItem(Icons.list_outlined, 'Sections',
                    '${_sections.length} sections, $totalLessons lessons'),
                const Divider(color: AppColors.borderDark, height: 24),
                _reviewItem(
                  Icons.monetization_on_outlined,
                  'Price',
                  price == 0 ? 'Free' : '\$${price.toStringAsFixed(2)} $_currency',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Description preview
          if (_descriptionController.text.isNotEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.cardDark,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderDark),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Description',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _descriptionController.text,
                    style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
                    maxLines: 5,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _reviewItem(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.textMuted),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLabel(String text, {bool required = false}) {
    return Text(
      required ? '$text *' : text,
      style: const TextStyle(
        color: AppColors.textSecondary,
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  void _showAddSectionDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Add Section', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
          style: const TextStyle(color: Colors.white),
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Section title'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.isNotEmpty) {
                setState(() {
                  _sections.add({
                    'title': controller.text,
                    'lessons': <Map<String, dynamic>>[],
                  });
                });
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Add', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showAddLessonDialog(int sectionIndex) {
    final titleCtrl = TextEditingController();
    final videoCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Add Lesson', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: titleCtrl,
              style: const TextStyle(color: Colors.white),
              autofocus: true,
              decoration: const InputDecoration(hintText: 'Lesson title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: videoCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(hintText: 'Video URL (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (titleCtrl.text.isNotEmpty) {
                setState(() {
                  final lessons = _sections[sectionIndex]['lessons']
                      as List<Map<String, dynamic>>;
                  lessons
                      .add({'title': titleCtrl.text, 'videoUrl': videoCtrl.text});
                });
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Add', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _saveCourse({required bool publish}) async {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Course title is required.')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final apiClient = ref.read(apiClientProvider);
      final price = double.tryParse(_priceController.text) ?? 0;

      final courseData = {
        'title': _titleController.text.trim(),
        'slug': _generateSlug(_titleController.text),
        'description': _descriptionController.text.trim(),
        'categoryId': _selectedCategory,
        'thumbnailUrl': _thumbnailUrlController.text.trim(),
        'price': price,
        'currency': _currency,
        'syllabus': _sections.map((s) {
          return {
            'title': s['title'],
            'lessons': (s['lessons'] as List).map((l) {
              return {'title': l['title'], 'videoUrl': l['videoUrl']};
            }).toList(),
          };
        }).toList(),
      };

      // Create the course
      final createResponse =
          await apiClient.post('/api/courses', data: courseData);
      final created = createResponse.data['data'] ?? createResponse.data;
      final courseId = created['id']?.toString() ?? '';

      // Publish if requested
      if (publish && courseId.isNotEmpty) {
        await apiClient.post('/api/courses/$courseId/publish');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(publish ? 'Course published!' : 'Draft saved!'),
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }
}
