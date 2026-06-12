import { Request, Response, NextFunction } from 'express';
import { EnrollmentService } from './enrollment.service';
import { AuthRequest } from '../../middleware/auth';

export class EnrollmentController {
  private enrollmentService: EnrollmentService;

  constructor() {
    this.enrollmentService = new EnrollmentService();
  }

  public enroll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enrollment = await this.enrollmentService.enroll(
        req.user!.id,
        req.body.courseId
      );
      res.status(201).json({ success: true, data: enrollment });
    } catch (error) {
      next(error);
    }
  };

  public getMyEnrollments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const enrollments = await this.enrollmentService.getMyEnrollments(
        req.user!.id,
        Number(page),
        Number(limit)
      );
      res.status(200).json({ success: true, data: enrollments });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enrollment = await this.enrollmentService.getById(req.params.id);
      // Check if user owns this enrollment or is instructor/admin
      const userId = req.user!.id;
      const isOwner = enrollment.userId === userId;
      const isInstructorOrAdmin = ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);
      
      if (!isOwner && !isInstructorOrAdmin) {
        throw new Error('Not authorized');
      }
      
      res.status(200).json({ success: true, data: enrollment });
    } catch (error) {
      next(error);
    }
  };

  public updateProgress = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enrollment = await this.enrollmentService.updateProgress(
        req.params.id,
        req.body.progress,
        req.user!.id
      );
      res.status(200).json({ success: true, data: enrollment });
    } catch (error) {
      next(error);
    }
  };

  public completeLesson = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const enrollment = await this.enrollmentService.completeLesson(
        req.params.id,
        req.body.lessonId,
        req.user!.id
      );
      res.status(200).json({ success: true, data: enrollment });
    } catch (error) {
      next(error);
    }
  };

  public getCourseEnrollments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const enrollments = await this.enrollmentService.getCourseEnrollments(
        req.params.courseId,
        Number(page),
        Number(limit)
      );
      // Only instructors/admins can see all enrollments for a course
      const isInstructorOrAdmin = ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);
      if (!isInstructorOrAdmin) {
        throw new Error('Not authorized');
      }
      
      res.status(200).json({ success: true, data: enrollments });
    } catch (error) {
      next(error);
    }
  };
}