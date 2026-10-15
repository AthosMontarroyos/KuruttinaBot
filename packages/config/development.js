// Explicit preload for native development commands, before either app reads .env.
process.env.APP_ENV = 'development';
