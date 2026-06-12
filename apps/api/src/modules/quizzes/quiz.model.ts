import { prisma } from '../../server';

export class Quiz {
  id: string;
  sectionId: string;
  title: string;
  description?: string;
  passingScore: number; // percentage
  timeLimit?: number; // minutes
  attemptsAllowed: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Quiz> & {
    sectionId: string;
    title: string;
    passingScore: number;
    attemptsAllowed: number;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.sectionId = data.sectionId;
    this.title = data.title;
    this.description = data.description;
    this.passingScore = data.passingScore;
    this.timeLimit = data.timeLimit;
    this.attemptsAllowed = data.attemptsAllowed;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save(): Promise<Quiz> {
    const quiz = await prisma.quiz.upsert({
      where: { id: this.id },
      update: {
        sectionId: this.sectionId,
        title: this.title,
        description: this.description,
        passingScore: this.passingScore,
        timeLimit: this.timeLimit,
        attemptsAllowed: this.attemptsAllowed,
        updatedAt: this.updatedAt = new Date(),
      },
      create: {
        id: this.id,
        sectionId: this.sectionId,
        title: this.title,
        description: this.description,
        passingScore: this.passingScore,
        timeLimit: this.timeLimit,
        attemptsAllowed: this.attemptsAllowed,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      },
    });

    Object.assign(this, quiz);
    return this;
  }

  static async findById(id: string): Promise<Quiz | null> {
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) return null;
    return new Quiz(quiz);
  }

  static async findBySectionId(sectionId: string): Promise<Quiz[]> {
    const quizzes = await prisma.quiz.findMany({
      where: { sectionId },
      orderBy: { createdAt: 'asc' },
    });
    return quizzes.map(q => new Quiz(q));
  }

  static async delete(id: string): Promise<boolean> {
    const result = await prisma.quiz.delete({ where: { id } });
    return !!result;
  }

  toJSON() {
    const {
      ...safeQuiz
    } = this;
    return safeQuiz;
  }
}

export class Question {
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
  }) {
    this.id = data.id || crypto.randomUUID();
    this.quizId = data.quizId;
    this.questionText = data.questionText;
    this.questionType = data.questionType;
    this.points = data.points;
    this.order = data.order;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save(): Promise<Question> {
    const question = await prisma.question.upsert({
      where: { id: this.id },
      update: {
        quizId: this.quizId,
        questionText: this.questionText,
        questionType: this.questionType,
        points: this.points,
        order: this.order,
        updatedAt: this.updatedAt = new Date(),
      },
      create: {
        id: this.id,
        quizId: this.quizId,
        questionText: this.questionText,
        questionType: this.questionType,
        points: this.points,
        order: this.order,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      },
    });

    Object.assign(this, question);
    return this;
  }

  static async findById(id: string): Promise<Question | null> {
    const question = await prisma.question.findUnique({ where: { id } });
    if (!question) return null;
    return new Question(question);
  }

  static async findByQuizId(quizId: string): Promise<Question[]> {
    const questions = await prisma.question.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
    });
    return questions.map(q => new Question(q));
  }

  static async delete(id: string): Promise<boolean> {
    const result = await prisma.question.delete({ where: { id } });
    return !!result;
  }

  toJSON() {
    const {
      ...safeQuestion
    } = this;
    return safeQuestion;
  }
}

export class Option {
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
  }) {
    this.id = data.id || crypto.randomUUID();
    this.questionId = data.questionId;
    this.optionText = data.optionText;
    this.isCorrect = data.isCorrect;
    this.order = data.order;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save(): Promise<Option> {
    const option = await prisma.option.upsert({
      where: { id: this.id },
      update: {
        questionId: this.questionId,
        optionText: this.optionText,
        isCorrect: this.isCorrect,
        order: this.order,
        updatedAt: this.updatedAt = new Date(),
      },
      create: {
        id: this.id,
        questionId: this.questionId,
        optionText: this.optionText,
        isCorrect: this.isCorrect,
        order: this.order,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      },
    });

    Object.assign(this, option);
    return this;
  }

  static async findById(id: string): Promise<Option | null> {
    const option = await prisma.option.findUnique({ where: { id } });
    if (!option) return null;
    return new Option(option);
  }

  static async findByQuestionId(questionId: string): Promise<Option[]> {
    const options = await prisma.option.findMany({
      where: { questionId },
      orderBy: { order: 'asc' },
    });
    return options.map(o => new Option(o));
  }

  static async delete(id: string): Promise<boolean> {
    const result = await prisma.option.delete({ where: { id } });
    return !!result;
  }

  toJSON() {
    const {
      ...safeOption
    } = this;
    return safeOption;
  }
}

export class QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  attemptNumber: number;
  score: number; // percentage
  passed: boolean;
  startedAt: Date;
  completedAt?: Date;
  answers: Record<string, any>; // questionId -> answer
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<QuizAttempt> & {
    quizId: string;
    userId: string;
    attemptNumber: number;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.quizId = data.quizId;
    this.userId = data.userId;
    this.attemptNumber = data.attemptNumber;
    this.score = data.score ?? 0;
    this.passed = data.passed ?? false;
    this.startedAt = data.startedAt || new Date();
    this.completedAt = data.completedAt;
    this.answers = data.answers ?? {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save(): Promise<QuizAttempt> {
    const attempt = await prisma.quizAttempt.upsert({
      where: { id: this.id },
      update: {
        quizId: this.quizId,
        userId: this.userId,
        attemptNumber: this.attemptNumber,
        score: this.score,
        passed: this.passed,
        completedAt: this.completedAt,
        answers: this.answers,
        updatedAt: this.updatedAt = new Date(),
      },
      create: {
        id: this.id,
        quizId: this.quizId,
        userId: this.userId,
        attemptNumber: this.attemptNumber,
        score: this.score,
        passed: this.passed,
        startedAt: this.startedAt,
        completedAt: this.completedAt,
        answers: this.answers,
      },
    });

    Object.assign(this, attempt);
    return this;
  }

  static async findById(id: string): Promise<QuizAttempt | null> {
    const attempt = await prisma.quizAttempt.findUnique({ where: { id } });
    if (!attempt) return null;
    return new QuizAttempt(attempt);
  }

  static async findByUserAndQuiz(userId: string, quizId: string): Promise<QuizAttempt[]> {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, quizId },
      orderBy: { attemptNumber: 'asc' },
    });
    return attempts.map(a => new QuizAttempt(a));
  }

  static async findLatestByUserAndQuiz(userId: string, quizId: string): Promise<QuizAttempt | null> {
    const attempt = await prisma.quizAttempt.findFirst({
      where: { userId, quizId },
      orderBy: { attemptNumber: 'desc' },
    });
    if (!attempt) return null;
    return new QuizAttempt(attempt);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await prisma.quizAttempt.delete({ where: { id } });
    return !!result;
  }

  toJSON() {
    const {
      ...safeAttempt
    } = this;
    return safeAttempt;
  }
}