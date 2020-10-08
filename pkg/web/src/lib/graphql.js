import storage from "../lib/storage.js";

const creds = storage("creds");

function printErrors(name, errors) {
  if (errors) {
    errors.forEach(e => console.error(name + ":", e.message));
  }
}

export async function gql(query, variables, { nocreds } = {}) {
  const res = await fetch("/graphql", {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(!nocreds && creds.jwt && { Authorization: `Bearer ${creds.jwt}` }),
    },
    body: JSON.stringify({ query, variables }),
    method: "POST",
    mode: "cors"
  });

  const name = /[^{(]+/.exec(query)?.[0].trim();
  if (!res.ok) {
    const e = new Error(`${res.status}: ${res.statusText}`);
    e.extra = {
      variables,
      url: res.url,
      body: await (res.headers
        .get("content-type")
        .startsWith("application/json")
        ? res.json()
        : res.text())
    };
    const errors = e.extra.body?.errors;
    printErrors(name, errors);
    throw e;
  }
  const { data, errors } = await res.json();
  printErrors(name, errors);
  return data;
}

const liveCurrent = {};
let ws;
let id = 0;
let wsReadyResolve;
const send = o => ws.send(JSON.stringify(o));
const wsReady = new Promise(resolve => { wsReadyResolve = resolve });
export async function live({ query, variables = {}}, cb) {
  if (!ws) openWs();
  await wsReady;
  liveCurrent[++id] = cb;
  send({ id, type: "start", payload: { query, variables } });
  return () => {
    delete liveCurrent[id];
    send({ id, type: "stop" });
  };
}
function openWs(query, cb) {
  ws = new WebSocket(`wss://${location.host}/graphql`, "graphql-ws");
  ws.onerror = (e) => console.log("err", e);
  ws.onclose = (e) => console.log("close", e);
  ws.onmessage = event => {
    const { data } = event;
    const d = JSON.parse(data);
    if (d.type == "connection_ack") {
      wsReadyResolve(ws);
    } else if (d.type == "data") {
      printErrors("live", d.payload?.errors)
      const cb = liveCurrent[d.id];
      if (cb) cb(d.payload);
      else console.error("NO CALLBACK FOR DATA", d);
    } else if (d.type == "ka") {
      // pass
    } else {
      console.log("????", d);
    }
  };
  ws.onopen = (e) => {
    setTimeout(() => {
      send({
        type: "connection_init",
        payload: { Authorization: `Bearer ${creds.jwt}` },
      });
    }, 0);
  };
  window.ws = ws;
}
