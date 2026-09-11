const target = process.argv[2];
if (target !== 'development' && target !== 'production') {
  console.error('Usage: runner development|production');
  process.exit(1);
}
process.env.BOT_TARGET = target;
await import('./index.js');
