const express = require("express");
const { postgraphile } = require("postgraphile");
const pg_simplify_inflector = require("@graphile-contrib/pg-simplify-inflector");

const app = express();

const DEV = process.env.NODE_ENV !== "production";

process.env["PGHOST"] = "/run/postgresql";

app.use(
  postgraphile(process.env.DATABASE_URL || "postgres://roiheimen_postgraphile:xyz@localhost/", "roiheimen", {
    //pgSettings(req) {
    //  console.log("req", req.query);
    //  if ('person' in req.query) return { role: "roiheimen_person" };
    //  return { role: "roiheimen_anonymous", };
    //},
    pgDefaultRole: "roiheimen_anonymous",
    jwtSecret: "secret_kitten",
    jwtPgTypeIdentifier: "roiheimen.jwt_token",

    disableQueryLog: !DEV, // querylog is slow
    enhanceGraphiql: DEV,
    enableCors: DEV,
    extendedErrors: DEV ? ["hint", "detail", "errcode"] : ["errcode"],
    graphiql: DEV,
    watchPg: DEV,

    appendPlugins: [pg_simplify_inflector],
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
