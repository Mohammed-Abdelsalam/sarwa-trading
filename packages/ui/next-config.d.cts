export declare const securityHeaders: { key: string; value: string }[];
export declare function contentSecurityPolicy(options: {
  nonce: string;
  dev?: boolean;
  https?: boolean;
  apiUrl?: string;
}): string;
export declare function forwardClientAddress(): void;
