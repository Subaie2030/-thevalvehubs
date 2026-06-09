/**
 * TheValveHubs — CORS + Response Helpers
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Handle preflight OPTIONS request
 */
function preflight() {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

/**
 * JSON success response
 */
function ok(data, statusCode = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

/**
 * JSON error response
 */
function err(message, statusCode = 400) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Parse JSON body safely
 */
function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

/**
 * Get query params
 */
function queryParams(event) {
  return event.queryStringParameters || {};
}

module.exports = { preflight, ok, err, parseBody, queryParams, CORS_HEADERS };
