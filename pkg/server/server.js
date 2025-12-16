const cluster = require("cluster");

const express = require("express");
const { postgraphile } = require("postgraphile");
const pg_simplify_inflector = require("@graphile-contrib/pg-simplify-inflector");
const cCPUs = require("os").cpus().length;

const { DEV, DATABASE_URL, OWNER_DATABASE_URL, JWT_SECRET } = require("./config.js");

if (cluster.isMaster) {
  const numForks = DEV ? 1 : cCPUs;
  for (let i = 0; i < numForks; i++) {
    cluster.fork();
  }

  cluster.on("online", function(worker) {
    console.log("Worker " + worker.process.pid + " is online.");
  });
  cluster.on("exit", function(worker, code, signal) {
    console.log("worker " + worker.process.pid + " died.");
  });
} else {
  const app = express();

  app.use(
    postgraphile(DATABASE_URL, "roiheimen", {
      //pgSettings(req) {
      //  console.log("req", req.query);
      //  if ('person' in req.query) return { role: "roiheimen_person" };
      //  return { role: "roiheimen_anonymous", };
      //},
      pgDefaultRole: "roiheimen_anonymous",
      jwtSecret: JWT_SECRET,
      jwtPgTypeIdentifier: "roiheimen.jwt_token",
      ownerConnectionString: OWNER_DATABASE_URL,

      disableQueryLog: !DEV, // querylog is slow
      enhanceGraphiql: DEV,
      enableCors: DEV,
      extendedErrors: DEV ? ["hint", "detail", "errcode"] : ["errcode"],
      graphiql: DEV,
      watchPg: DEV,

      appendPlugins: [pg_simplify_inflector, require("@graphile/subscriptions-lds").default],
      live: true,
      dynamicJson: true,
      enableQueryBatching: true,
      ignoreIndexes: false,
      ignoreRBAC: false,
      legacyRelations: "omit",
      retryOnInitFail: true,
      setofFunctionsContainNulls: false,
      subscriptions: true,
    })
  );

  const port = process.env.PORT || 3000;
  app.listen(port);

  console.log(`Listening on http://localhost:${port}${DEV ? " (dev mode)" : ""}`);
  if (DEV) {
    console.log(`Graphiql at http://localhost:${port}/graphiql`);
  }
}
