import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '30m'; // 30 minutes

export interface TokenPayload {
  grytUserId: string;
  serverUserId: string;
  nickname: string;
  serverHost: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function refreshToken(token: string): string | null {
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  
  // Remove 'exp' and 'iat' from payload before signing new token
  const { exp, iat, ...cleanPayload } = payload as any;
  return generateAccessToken(cleanPayload);
}
