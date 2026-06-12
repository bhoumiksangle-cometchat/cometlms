import { UserService } from './user.service';
export class UserController {
    userService;
    constructor() {
        this.userService = new UserService();
    }
    getProfile = async (req, res, next) => {
        try {
            const user = await this.userService.getProfile(req.user.id);
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    };
    updateProfile = async (req, res, next) => {
        try {
            const user = await this.userService.updateProfile(req.user.id, req.body);
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    };
    getAll = async (req, res, next) => {
        try {
            const { page = 1, limit = 10, role, isActive } = req.query;
            const users = await this.userService.getAll({
                page: Number(page),
                limit: Number(limit),
                role: role,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            });
            res.status(200).json({ success: true, data: users });
        }
        catch (error) {
            next(error);
        }
    };
    getById = async (req, res, next) => {
        try {
            const user = await this.userService.getById(req.params.id);
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    };
    deactivate = async (req, res, next) => {
        try {
            await this.userService.deactivate(req.params.id);
            res.status(200).json({ success: true, message: 'User deactivated successfully' });
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=user.controller.js.map