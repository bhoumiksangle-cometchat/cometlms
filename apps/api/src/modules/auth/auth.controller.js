import { AuthService } from './auth.service';
export class AuthController {
    authService;
    constructor() {
        this.authService = new AuthService();
    }
    register = async (req, res, next) => {
        try {
            const result = await this.authService.register(req.body);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    };
    login = async (req, res, next) => {
        try {
            const result = await this.authService.login(req.body);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    };
    logout = async (req, res, next) => {
        try {
            await this.authService.logout(req.user.id);
            res.status(200).json({ success: true, message: 'Logged out successfully' });
        }
        catch (error) {
            next(error);
        }
    };
    refresh = async (req, res, next) => {
        try {
            const result = await this.authService.refresh(req.body.refreshToken);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    };
    getProfile = async (req, res, next) => {
        try {
            const user = await this.authService.getProfile(req.user.id);
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=auth.controller.js.map