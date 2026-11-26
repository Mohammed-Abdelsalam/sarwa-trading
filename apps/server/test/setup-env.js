// Runs before every test file: point Prisma at the test database, not dev.db.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-at-least-16-chars';
