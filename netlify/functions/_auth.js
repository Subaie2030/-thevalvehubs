/**
 * TheValveHubs — JWT Auth Utilities
 */
const jwt = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET || 'tvh_dev_secret_replace_in_prod_2026';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Sign a JWT token for a user
 */
function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

/**
 * Verify a JWT token — returns decoded payload or null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(headers) {
  const auth = headers.authorization || headers.Authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/**
 * Middleware-style: get current user from request headers
 * Returns user object or null
 */
function getRequestUser(event) {
  const token = extractToken(event.headers);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Require auth — call from function handler
 * Returns { user } or throws/returns 401
 */
function requireAuth(event) {
  const user = getRequestUser(event);
  if (!user) {
    return { error: true, response: { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized — please log in' }) } };
  }
  return { user };
}

/**
 * Require admin role
 */
function requireAdmin(event) {
  const { user, error, response } = requireAuth(event);
  if (error) return { error, response };
  if (user.role !== 'admin') {
    return { error: true, response: { statusCode: 403, body: JSON.stringify({ error: 'Forbidden — admin only' }) } };
  }
  return { user };
}

module.exports = { signToken, verifyToken, extractToken, getRequestUser, requireAuth, requireAdmin };
