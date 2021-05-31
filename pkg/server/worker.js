const { run, quickAddJob } = require("graphile-worker");

const { OWNER_DATABASE_URL } = require("./config.js");

async function main() {
  // Run a worker to execute jobs:
  const runner = await run({
    connectionString: OWNER_DATABASE_URL,
    concurrency: 5,
    // Install signal handlers for graceful shutdown on SIGINT, SIGTERM, etc
    noHandleSignals: false,
    pollInterval: 1000,
    taskDirectory: `${__dirname}/tasks`,
  });

  // If the worker exits (whether through fatal error or otherwise), this
  // promise will resolve/reject:
  await runner.promise;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
