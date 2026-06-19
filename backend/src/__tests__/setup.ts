import 'dotenv/config'

// Override sensitive credentials with safe test values.
// DATABASE_URL is intentionally left as-is from .env so E2E tests can
// reach the real database (they clean up after themselves via afterEach).
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars!'
process.env.BACKEND_URL = 'http://localhost:3000'
// Don't restrict email in tests — individual tests set this themselves
delete process.env.ALLOWED_EMAIL
