const express = require("express");
const { postgraphile } = require("postgraphile");
const pg_simplify_inflector = require("@graphile-contrib/pg-simplify-inflector");

const app = express();

const DEV = process.env.NODE_ENV === "development";

app.use(
  postgraphile(process.env.DATABASE_URL || "postgres:///fkweb", "public", {
    disableQueryLog: !DEV, // querylog is slow
    enhanceGraphiql: DEV,
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
    pgSettings(req) {
      /* TODO */
    }
  })
);

const port = process.env.PORT || 3000;
app.listen(port);

console.log(`Listening on http://localhost:${port}${DEV ? " (dev mode)" : ""}`);
