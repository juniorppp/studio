
// It's crucial to set this in your .env.local file for security
export const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-super-secret-key-for-development';
export const AUTH_COOKIE_NAME = 'bill_bliss_auth_token';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'your-fallback-super-secret-key-for-development') {
  console.warn(
    'WARNING: JWT_SECRET is using a default fallback value. ' +
    'For production, set a strong, unique JWT_SECRET in your environment variables.'
  );
}
