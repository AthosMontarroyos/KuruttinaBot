const target = process.argv[2];
if (target !== 'development' && target !== 'production') {
  console.error('Usage: runner development|production');
  process.exit(1);
}
process.env.APP_ENV = target;
await import('./index.js');
