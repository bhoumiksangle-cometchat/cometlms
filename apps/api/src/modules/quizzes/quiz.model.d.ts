export declare class Quiz {
    id: string;
    sectionId: string;
    title: string;
    description?: string;
    passingScore: number;
    timeLimit?: number;
    attemptsAllowed: number;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: Partial<Quiz> & {
        sectionId: string;
        title: string;
        passingScore: number;
        attemptsAllowed: number;
    });
    save(): Promise<Quiz>;
    static findById(id: string): Promise<Quiz | null>;
    static findBySectionId(sectionId: string): Promise<Quiz[]>;
    static delete(id: string): Promise<boolean>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
export declare class Question {
    id: string;
    quizId: string;
    questionText: string;
    questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
    points: number;
    order: number;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: Partial<Question> & {
        quizId: string;
        questionText: string;
        questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
        points: number;
        order: number;
    });
    save(): Promise<Question>;
    static findById(id: string): Promise<Question | null>;
    static findByQuizId(quizId: string): Promise<Question[]>;
    static delete(id: string): Promise<boolean>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
export declare class Option {
    id: string;
    questionId: string;
    optionText: string;
    isCorrect: boolean;
    order: number;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: Partial<Option> & {
        questionId: string;
        optionText: string;
        isCorrect: boolean;
        order: number;
    });
    save(): Promise<Option>;
    static findById(id: string): Promise<Option | null>;
    static findByQuestionId(questionId: string): Promise<Option[]>;
    static delete(id: string): Promise<boolean>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
export declare class QuizAttempt {
    id: string;
    quizId: string;
    userId: string;
    attemptNumber: number;
    score: number;
    passed: boolean;
    startedAt: Date;
    completedAt?: Date;
    answers: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    constructor(data: Partial<QuizAttempt> & {
        quizId: string;
        userId: string;
        attemptNumber: number;
    });
    save(): Promise<QuizAttempt>;
    static findById(id: string): Promise<QuizAttempt | null>;
    static findByUserAndQuiz(userId: string, quizId: string): Promise<QuizAttempt[]>;
    static findLatestByUserAndQuiz(userId: string, quizId: string): Promise<QuizAttempt | null>;
    static delete(id: string): Promise<boolean>;
    toJSON(): Omit<this, "save" | "toJSON">;
}
//# sourceMappingURL=quiz.model.d.ts.map