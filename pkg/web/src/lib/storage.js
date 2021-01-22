const db = Object.create(null);

export function save(name) {
  localStorage.setItem(name, JSON.stringify(db[name]));
}

function handleEvent() {
  const { name } = this;
  save(name);
}

function set(name) {
  //addEventListener("beforeunload", { name, handleEvent }, false);
  return (db[name] = JSON.parse(localStorage.getItem(name) || "{}"));
}

export default function get(name) {
  return db[name] || set(name);
}
