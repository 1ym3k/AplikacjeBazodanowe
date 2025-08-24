const path = require("path");
require("dotenv").config();

const { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE } = process.env;

module.exports = {
  development: {
    client: "postgresql",
    connection: {
      host: PG_HOST || "localhost",
      port: PG_PORT || 5432,
      user: PG_USER || "postgres",
      password: PG_PASSWORD || "password",
      database: PG_DATABASE || "konie"
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, "db", "migrations")
    },
    seeds: {
      directory: path.join(__dirname, "db", "seeds")
    }
  },
  staging: {
    client: "postgresql",
    connection: {
      host: PG_HOST || "localhost",
      port: PG_PORT || 5432,
      user: PG_USER || "postgres",
      password: PG_PASSWORD || "password",
      database: PG_DATABASE || "konie"
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, "db", "migrations")
    },
    seeds: {
      directory: path.join(__dirname, "db", "seeds", "staging")
    }
  },
  production: {
    client: "postgresql",
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, "db", "migrations")
    },
    seeds: {
      directory: path.join(__dirname, "db", "seeds", "production")
    }
  }
};