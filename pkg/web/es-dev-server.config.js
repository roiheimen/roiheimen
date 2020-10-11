const proxy = require("koa-http2-proxy");

module.exports = {
  http2: true,
  rootDir: "src/",
  compatibility: "none",
  watch: true,
  port: 8080,
  sslCert: "cert.crt",
  sslKey: "cert.key",
  middlewares: [
    proxy("/graphql", { target: "http://localhost:3000", ws: true, changeOrigin: true }),
    proxy("/graphiql", { target: "http://localhost:3000", changeOrigin: true }),
  ],
};
