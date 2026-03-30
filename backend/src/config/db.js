import pkg from "pg";
const { Pool } = pkg;

const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "esports_platform",
  password: "Shivaayxyz@7",
  port: 5432,
});

module.exports = pool;


