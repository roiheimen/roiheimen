import storage from "../lib/storage.js";

const creds = storage("creds");

function printErrors(name, errors) {
  if (errors) {
    errors.forEach((e) => console.error(name + ":", e.message));
  }
}

function getName(query) {
  return /[^{(]+/.exec(query)?.[0].trim();
}

export async function gql(query, variables, { jwt } = {}) {
  jwt = jwt === undefined ? creds.jwt : jwt;
  const res = await fetch("/graphql", {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(jwt && { Authorization: `Bearer ${jwt}` }),
    },
    body: JSON.stringify({ query, variables }),
    method: "POST",
    mode: "cors",
  });

  const name = getName(query);
  if (!res.ok) {
    const e = new Error(`${res.status}: ${res.statusText}`);
    e.extra = {
      variables,
      url: res.url,
      body: await (res.headers.get("content-type").startsWith("application/json") ? res.json() : res.text()),
    };
    const errors = e.extra.body?.errors;
    printErrors(name, errors);
    throw e;
  }
  const { data, errors } = await res.json();
  printErrors(name, errors);
  if (!data && errors) {
    const e = new Error(`Error returned for ${name}`);
    e.extra = { body: { errors } };
    throw e;
  }
  return data;
}

let liveErrorCb;
export function setLiveErrorCb(cb) {
  liveErrorCb = cb;
}

const liveCurrent = {};
let curId = 0;
let timeout;
const send = (ws, o) => ws.send(JSON.stringify(o));
export async function live({ query, variables = {} }, cb) {
  const ws = await openWs();
  const id = ++curId;
  const name = getName(query);
  liveCurrent[id] = { query, variables, cb };
  console.info(`ws live subscribe id:${id} name:${name}`);
  send(ws, { id, type: "start", payload: { query, variables } });
  return () => {
    console.info(`ws live stop id:${id} name:${name}`);
    delete liveCurrent[id];
    send(ws, { id, type: "stop" });
  };
}
let connTries = 0;
let kaTimeout;
async function reconn() {
  const rand = Math.random();
  const ms = connTries ? connTries * rand * 1000 : 0;
  console.info(`ws reconn after ${ms} ms, conntries ${connTries}`);

  const orgConnTries = connTries;
  await new Promise((res) => setTimeout(res, ms));
  if (orgConnTries != connTries) {
    console.info(`ws reconn: already tried during our break`);
    return;
  }
  openWs(true);
}
let wsReady;
async function openWs(reconnect) {
  if (wsReady && !reconnect) return wsReady;
  connTries++;
  let resolve;
  let reject;
  wsReady = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const ws = new WebSocket(`wss://${location.host}/graphql`, "graphql-ws");
  ws.onerror = (e) => console.error("ws err", e);
  ws.onclose = (e) => {
    console.info("ws close", e);
    reconn();
  };
  ws.onmessage = (event) => {
    const { data } = event;
    const d = JSON.parse(data);
    clearTimeout(kaTimeout);
    kaTimeout = setTimeout(() => {
      console.log("WS Timed out! last:", d);
      reconn();
    }, 20 * 1000 + Math.random() * 1000);
    if (d.type == "connection_ack") {
      connTries = 0;
      for (const [id, { query, variables }] of Object.entries(liveCurrent)) {
        const name = getName(query);
        console.info(`resending id:${id} name:${name}`);
        send(ws, { id, type: "start", payload: { query, variables } });
      }
      resolve(ws);
    } else if (d.type == "data") {
      printErrors("live", d.payload?.errors);
      const cb = liveCurrent[d.id]?.cb;
      if (cb) cb(d.payload);
      else console.error("NO CALLBACK FOR DATA", d);
    } else if (d.type == "ka" || d.type == "complete") {
      // pass
    } else if (d.type == "error") {
      if (liveErrorCb) liveErrorCb(d.payload);
      console.error("live graphql error", d);
    } else {
      console.log("????", d);
    }
  };
  ws.onopen = (e) => {
    setTimeout(() => {
      send(ws, {
        type: "connection_init",
        payload: { Authorization: `Bearer ${creds.jwt}` },
      });
    }, 0);
  };
  return wsReady;
}
