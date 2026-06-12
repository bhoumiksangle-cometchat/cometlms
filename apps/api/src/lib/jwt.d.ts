export declare const generateToken: (userId: string) => string;
export declare const generateRefreshToken: (userId: string) => string;
export declare const verifyToken: (token: string) => {
    userId: string;
};
export declare const verifyRefreshToken: (token: string) => {
    userId: string;
};
//# sourceMappingURL=jwt.d.ts.map