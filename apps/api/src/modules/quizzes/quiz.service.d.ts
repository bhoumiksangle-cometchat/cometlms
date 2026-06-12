import { Quiz, QuizAttempt } from './quiz.model';
export declare class QuizService {
    getBySection(sectionId: string): Promise<any>;
    getById(id: string): Promise<Quiz>;
    create(data: {
        sectionId: string;
        title: string;
        description?: string;
        passingScore: number;
        timeLimit?: number;
        attemptsAllowed: number;
        questions?: Array<{
            questionText: string;
            questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
            points: number;
            order: number;
            options?: Array<{
                optionText: string;
                isCorrect: boolean;
                order: number;
            }>;
        }>;
    }): Promise<Quiz>;
    update(id: string, data: Partial<{
        title: string;
        description: string;
        passingScore: number;
        timeLimit: number;
        attemptsAllowed: number;
    }>): Promise<Quiz>;
    delete(id: string): Promise<void>;
    submit(quizId: string, userId: string, answers: Record<string, string | string[]>): Promise<{
        attempt: QuizAttempt;
        score: number;
        passed: boolean;
        totalPoints: number;
        earnedPoints: number;
    }>;
    getAttempts(quizId: string, userId: string): Promise<any>;
    getLatestAttempt(quizId: string, userId: string): Promise<QuizAttempt | null>;
}
//# sourceMappingURL=quiz.service.d.ts.map