import storage from "../lib/storage.js";

const creds = storage("creds");
if (creds.num) {
  creds.num = null;
  location.reload();
}
