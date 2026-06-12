import { CourseService } from './course.service';
export class CourseController {
    courseService;
    constructor() {
        this.courseService = new CourseService();
    }
    getAll = async (req, res, next) => {
        try {
            const { page = 1, limit = 10, search, level, language, status } = req.query;
            const courses = await this.courseService.getAll({
                page: Number(page),
                limit: Number(limit),
                search: search,
                level: level,
                language: language,
                status: status,
            });
            res.status(200).json({ success: true, data: courses });
        }
        catch (error) {
            next(error);
        }
    };
    getById = async (req, res, next) => {
        try {
            const course = await this.courseService.getById(req.params.id);
            res.status(200).json({ success: true, data: course });
        }
        catch (error) {
            next(error);
        }
    };
    getBySlug = async (req, res, next) => {
        try {
            const course = await this.courseService.getBySlug(req.params.slug);
            res.status(200).json({ success: true, data: course });
        }
        catch (error) {
            next(error);
        }
    };
    create = async (req, res, next) => {
        try {
            const course = await this.courseService.create(req.body, req.user.id);
            res.status(201).json({ success: true, data: course });
        }
        catch (error) {
            next(error);
        }
    };
    update = async (req, res, next) => {
        try {
            const course = await this.courseService.update(req.params.id, req.body, req.user.id);
            res.status(200).json({ success: true, data: course });
        }
        catch (error) {
            next(error);
        }
    };
    delete = async (req, res, next) => {
        try {
            await this.courseService.delete(req.params.id, req.user.id);
            res.status(200).json({ success: true, message: 'Course deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    };
    publish = async (req, res, next) => {
        try {
            const course = await this.courseService.publish(req.params.id, req.user.id);
            res.status(200).json({ success: true, data: course });
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=course.controller.js.map