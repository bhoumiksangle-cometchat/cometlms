export function errorHandler(error, _req, res, _next) {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
        success: false,
        error: statusCode === 500 ? 'Internal server error' : error.message,
    });
}
//# sourceMappingURL=errorHandler.js.map