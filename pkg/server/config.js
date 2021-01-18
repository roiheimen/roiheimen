
process.env["PGHOST"] = "/run/postgresql";

const DEV = process.env.NODE_ENV !== "production";
const DATABASE_URL = process.env.DATABASE_URL || "postgres://roiheimen_postgraphile:xyz@localhost/odin";
const OWNER_DATABASE_URL = process.env.OWNER_DATABASE_URL || "postgres:///";

module.exports = { DEV, DATABASE_URL, OWNER_DATABASE_URL }
