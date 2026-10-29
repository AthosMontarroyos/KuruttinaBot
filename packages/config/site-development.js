import './development.js';

// `npm run site dev` does not call Doppler. A parent `doppler run` injects SITE_DATABASE_URL
// and the bot's DATABASE_URL together; the site must read the site role.
const siteDatabaseUrl = process.env.SITE_DATABASE_URL?.trim();
if (siteDatabaseUrl) process.env.DATABASE_URL = siteDatabaseUrl;
