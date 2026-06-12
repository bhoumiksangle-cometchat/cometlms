import { QuizService } from './quiz.service';
export class QuizController {
    quizService;
    constructor() {
        this.quizService = new QuizService();
    }
    getBySection = async (req, res, next) => {
        try {
            const quizzes = await this.quizService.getBySection(req.params.sectionId);
            res.status(200).json({ success: true, data: quizzes });
        }
        catch (error) {
            next(error);
        }
    };
    getById = async (req, res, next) => {
        try {
            const quiz = await this.quizService.getById(req.params.id);
            res.status(200).json({ success: true, data: quiz });
        }
        catch (error) {
            next(error);
        }
    };
    create = async (req, res, next) => {
        try {
            // Only instructors/admins can create quizzes
            if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
                throw new Error('Not authorized');
            }
            const quiz = await this.quizService.create(req.body);
            res.status(201).json({ success: true, data: quiz });
        }
        catch (error) {
            next(error);
        }
    };
    update = async (req, res, next) => {
        try {
            // Only instructors/admins can update quizzes
            if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
                throw new Error('Not authorized');
            }
            const quiz = await this.quizService.update(req.params.id, req.body);
            res.status(200).json({ success: true, data: quiz });
        }
        catch (error) {
            next(error);
        }
    };
    delete = async (req, res, next) => {
        try {
            // Only instructors/admins can delete quizzes
            if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
                throw new Error('Not authorized');
            }
            await this.quizService.delete(req.params.id);
            res.status(200).json({ success: true, message: 'Quiz deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    };
    submit = async (req, res, next) => {
        try {
            const result = await this.quizService.submit(req.params.id, req.user.id, req.body.answers);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    };
    getAttempts = async (req, res, next) => {
        try {
            const attempts = await this.quizService.getAttempts(req.params.id, req.user.id);
            res.status(200).json({ success: true, data: attempts });
        }
        catch (error) {
            next(error);
        }
    };
    getLatestAttempt = async (req, res, next) => {
        try {
            const attempt = await this.quizService.getLatestAttempt(req.params.id, req.user.id);
            res.status(200).json({ success: true, data: attempt });
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=quiz.controller.js.map