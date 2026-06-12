import { Request, Response, NextFunction } from 'express';
import { CourseService } from './course.service';
import { AuthRequest } from '../../middleware/auth';
import { authorize } from '../../middleware/auth';

export class CourseController {
  private courseService: CourseService;

  constructor() {
    this.courseService = new CourseService();
  }

  public getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = 1, limit = 10, search, level, language, status } = req.query;
      const courses = await this.courseService.getAll({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        level: level as string,
        language: language as string,
        status: status as string,
      });
      res.status(200).json({ success: true, data: courses });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const course = await this.courseService.getById(req.params.id);
      res.status(200).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  };

  public getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const course = await this.courseService.getBySlug(req.params.slug);
      res.status(200).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  };

  public create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const course = await this.courseService.create(req.body, req.user!.id);
      res.status(201).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  };

  public update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const course = await this.courseService.update(req.params.id, req.body, req.user!.id);
      res.status(200).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  };

  public delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.courseService.delete(req.params.id, req.user!.id);
      res.status(200).json({ success: true, message: 'Course deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  public publish = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const course = await this.courseService.publish(req.params.id, req.user!.id);
      res.status(200).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  };
}