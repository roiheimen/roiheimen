const proxy = require("koa-http2-proxy");

// Middleware to handle /i/{code} invite links
async function inviteRedirect(ctx, next) {
  const match = ctx.url.match(/^\/i\/([A-Za-z0-9]+)$/);
  if (match) {
    const code = match[1];
    ctx.redirect(`/bli-med.html?code=${code}`);
    // Don't call next() - we're done with a redirect
    return;
  }
  await next();
}

module.exports = {
  //http2: true, -- if using Whereby, also add --ssl-cert --ssl-key and this
  rootDir: "src",
  appIndex: "index.html",
  compatibility: "none",
  nodeResolve: false,
  watch: true,
  port: 8080,
  middlewares: [
    inviteRedirect,
    proxy("/graphql", { target: "http://localhost:3000", ws: true, changeOrigin: true }),
    proxy("/graphiql", { target: "http://localhost:3000", changeOrigin: true }),
  ],
};
