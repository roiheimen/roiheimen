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
export async function live(query, cb) {
  const variables = {};
  const ws = new WebSocket(`wss://${location.host}/graphql`, "graphql-ws");
  const send = o => ws.send(JSON.stringify(o));
  ws.onerror = (e) => console.log("err", e);
  ws.onclose = (e) => console.log("close", e);
  ws.onmessage = event => {
    const { data } = event;
    const d = JSON.parse(data);
    if (d.type == "connection_ack") {
      send({
        type: "start",
        payload: { query, variables, operationName: "SakAndSpeeches" },
        id: 1,
      });
    } else if (d.type == "data") {
      printErrors("live", d.payload?.errors)
      cb(d.payload);
    } else if (d.type == "ka") {
      // pass
    } else {
      console.log("????", d);
    }
  };
  ws.onopen = (e) => {
    console.log("open", e);
    setTimeout(() => {
      console.log("init");
      send({
        type: "connection_init",
        payload: { Authorization: `Bearer ${creds.jwt}` },
      });
    }, 1000);
  };
  window.ws = ws;
}
