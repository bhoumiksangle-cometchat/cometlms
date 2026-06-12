import { Request, Response, NextFunction } from 'express';
import { QuizService } from './quiz.service';
import { AuthRequest } from '../../middleware/auth';
import { authorize } from '../../middleware/auth';

export class QuizController {
  private quizService: QuizService;

  constructor() {
    this.quizService = new QuizService();
  }

  public getBySection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const quizzes = await this.quizService.getBySection(req.params.sectionId);
      res.status(200).json({ success: true, data: quizzes });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const quiz = await this.quizService.getById(req.params.id);
      res.status(200).json({ success: true, data: quiz });
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only instructors/admins can create quizzes
      if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        throw new Error('Not authorized');
      }
      
      const quiz = await this.quizService.create(req.body);
      res.status(201).json({ success: true, data: quiz });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only instructors/admins can update quizzes
      if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        throw new Error('Not authorized');
      }
      
      const quiz = await this.quizService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: quiz });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Only instructors/admins can delete quizzes
      if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        throw new Error('Not authorized');
      }
      
      await this.quizService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Quiz deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  public submit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.quizService.submit(
        req.params.id,
        req.user!.id,
        req.body.answers
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  public getAttempts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const attempts = await this.quizService.getAttempts(
        req.params.id,
        req.user!.id
      );
      res.status(200).json({ success: true, data: attempts });
    } catch (error) {
      next(error);
    }
  };

  public getLatestAttempt = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const attempt = await this.quizService.getLatestAttempt(
        req.params.id,
        req.user!.id
      );
      res.status(200).json({ success: true, data: attempt });
    } catch (error) {
      next(error);
    }
  };
}