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

  // Or add a job to be executed:
  await quickAddJob(
    // makeWorkerUtils options
    { connectionString: OWNER_DATABASE_URL },

    // Task identifier
    "hello",

    // Payload
    { name: "Bobby Tables" },
  );

  // If the worker exits (whether through fatal error or otherwise), this
  // promise will resolve/reject:
  await runner.promise;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
