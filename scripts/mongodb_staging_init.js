// Author: Jonathan Kakesa (JonathanK-N). Credentials stay in process environment.
try {
  const admin = db.getSiblingDB('admin');
  if (!admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) quit(1);
  let status;
  try { status = admin.runCommand({ replSetGetStatus: 1 }); } catch (error) {
    if (error.code !== 94) throw error;
    status = { code: 94 };
  }
  if (status.code === 94) {
    const initiated = admin.runCommand({ replSetInitiate: { _id: 'afrimarket-staging-rs', members: [{ _id: 0, host: process.env.RAILWAY_PRIVATE_DOMAIN + ':27017' }] } });
    if (!initiated.ok) quit(1);
  } else if (!status.ok) quit(1);
  const hello = admin.runCommand({ hello: 1 });
  if (hello.setName !== 'afrimarket-staging-rs' || !hello.isWritablePrimary) quit(1);
  const application = db.getSiblingDB('afrimarket_staging_synthetic');
  if (!application.getUser('afrimarket_staging')) {
    application.createUser({ user: 'afrimarket_staging', pwd: process.env.MONGO_APP_PASSWORD, roles: [{ role: 'readWrite', db: 'afrimarket_staging_synthetic' }] });
  }
  if (!application.auth('afrimarket_staging', process.env.MONGO_APP_PASSWORD)) quit(1);
  quit(0);
} catch {
  // Never include authentication commands or connection strings in bootstrap logs.
  quit(1);
}
