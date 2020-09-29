import storage from "../lib/storage.js";

const creds = storage("creds");

function printErrors(name, errors) {
  if (errors) {
    errors.forEach(e => console.error(name + ":", e.message));
  }
}

export async function gql(query, variables, { nocreds } = {}) {
  const res = await fetch(location.hostname.endsWith("localhost") ? "/graphql" : "http://localhost:3000/graphql?person", {
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
