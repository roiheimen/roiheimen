const express = require("express");
const { makeWorkerUtils } = require("graphile-worker");

const { DEV, OWNER_DATABASE_URL } = require("./config.js");

let emojis = {
  like: 0,
  heart: 0,
};
const emoji_set = new Set(Object.keys(emojis));

let worker;

const app = express();
app.post("/emoji/:type", (req, res) => {
  const type = req.params.type;
  if (emoji_set.has(type)) {
    emojis[type]++;
    res.send("ok");
  } else {
    res.status(404).send("not found: " + type);
  }
});
app.get("/emoji_count", (req, res) => {
  res.send(emojis);
});

let send_update_ms = 1000;
let last_update = Date.now();
async function send_emojis() {
  const ret = {};
  try {
    for (const type of Object.keys(emojis)) {
      if (emojis[type]) {
        ret[type] = emojis[type];
        emojis[type] = 0;
      }
    }
    if (!Object.keys(ret).length) {
      return setTimeout(send_emojis, send_update_ms);
    }
    await worker.addJob("update_emojis", { emojis: ret });
  } catch(e) {
    console.error(e);
    send_update_ms = Math.min(60 * 1000, send_update_ms * 2);
  }
  setTimeout(send_emojis, send_update_ms);
  if (DEV) {
    console.log("since last update", (Date.now() - last_update) / 1000, ret);
  }
  last_update = Date.now();
}

async function main() {
  worker = await makeWorkerUtils({ connectionString: OWNER_DATABASE_URL });
  await worker.migrate();

  send_emojis();
}

try {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT);
  console.log(`Running on http://localhost:${PORT}`);

  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
