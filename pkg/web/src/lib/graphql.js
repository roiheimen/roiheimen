import storage from "../lib/storage.js";

const creds = storage("creds");

export async function gql(query, variables) {
  const res = await fetch(location.hostname.endsWith("localhost") ? "/graphql" : "http://localhost:3000/graphql?person", {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(creds.jwt && { Authorization: `Bearer ${creds.jwt}` }),
    },
    body: JSON.stringify({ query, variables }),
    method: "POST",
    mode: "cors"
  });

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
    console.error(res, e.extra);
    throw e;
  }
  const { data, errors } = await res.json();
  if (errors) {
    const name = /[^{(]+/.exec(query)?.[0];
    errors.forEach(e => console.error(name + ":", e.message));
  }
  return data;
}
