interface GenerateQRResponse {
    qrImage: string;
    sessionId: string;
    createdAt: number;
}
interface VerifyQRResponse {
    success: boolean;
    error?: string;
    message?: string;
    sessionId?: string;
    eventId?: string;
}
export declare function generateQRCode(): Promise<GenerateQRResponse>;
export declare function verifyQRCode(sessionId: string): Promise<VerifyQRResponse>;
export {};
//# sourceMappingURL=QRCodeService.d.ts.map