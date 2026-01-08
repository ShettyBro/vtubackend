export interface JWTPayload {
    userId: string;
    role: string;
    [key: string]: unknown;
}
export declare function signJWT(payload: JWTPayload): string;
export declare function verifyJWT(token: string): JWTPayload;
export declare function extractBearerToken(authHeader: string | undefined): string;
//# sourceMappingURL=jwt.d.ts.map