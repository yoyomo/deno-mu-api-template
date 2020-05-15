import { Pool } from "https://deno.land/x/postgres/mod.ts";
import {
  walkSync,
  readFileStrSync,
  writeFileStrSync,
} from "https://deno.land/std/fs/mod.ts";

const ENV = Deno.env.toObject();
const MAX_POOL_SIZE = 5;
const DBHeadConfig = {
  host: ENV.DATABASE_HOST,
  database: "postgres",
  port: parseInt(ENV.DATABASE_PORT),
};

const DBUserConfig = {
  ...DBHeadConfig,
  user: ENV.DATABASE_USER,
  password: ENV.DATABASE_PASSWORD,
};

export const initDB = (databaseName?: string) => (
  new Pool({
    ...DBUserConfig,
    database: databaseName || ENV.DATABASE_NAME,
  }, MAX_POOL_SIZE)
);

const transaction = async (pool: Pool, trans: (p: Pool) => void) => {
  try {
    await trans(pool);
  } catch (e) {
    console.error("Error: ", e.message);
  } finally {
    pool.end();
  }
};

type Migration = {
  ts: number;
  created_ad: number;
};

export default {
  init: async () => {
    console.log('Creating user "' + ENV.DATABASE_USER + '"...');

    transaction(new Pool({ ...DBHeadConfig }, MAX_POOL_SIZE), async (pool) => {
      await pool.query('CREATE USER "' + ENV.DATABASE_USER + '" CREATEDB;');
      console.log('User "' + ENV.DATABASE_USER + '" created!');
    });
  },
  uninit: async () => {
    console.log('Deleting user "' + ENV.DATABASE_USER + '"...');

    transaction(new Pool({ ...DBHeadConfig }, MAX_POOL_SIZE), async (pool) => {
      await pool.query('DROP ROLE "' + ENV.DATABASE_USER + '";');
      console.log('User "' + ENV.DATABASE_USER + '" deleted.');
    });
  },
  create: async () => {
    console.log('Creating database "' + ENV.DATABASE_NAME + '"...');

    transaction(initDB(DBHeadConfig.database), async (db) => {
      await db.query('CREATE DATABASE "' + ENV.DATABASE_NAME + '";');
      console.log('Successfully created database "' + ENV.DATABASE_NAME + '"!');
    });
  },
  drop: async () => {
    console.log('Dropping database "' + ENV.DATABASE_NAME + '"...');

    transaction(initDB(DBHeadConfig.database), async (db) => {
      await db.query('DROP DATABASE "' + ENV.DATABASE_NAME + '";');
      console.log('Database "' + ENV.DATABASE_NAME + '" has been dropped.');
    });
  },
  migrate: async () => {
    console.log("Migrating new files...");

    transaction(initDB(), async (db) => {
      await db.query(
        'CREATE TABLE IF NOT EXISTS "migrations" (ts timestamp, created_at timestamp);',
      );

      const pastMigrations = (await db.query(
        'SELECT EXTRACT(EPOCH from ts)::integer as ts from "migrations"',
      )).rows.map((m: Migration) => m.ts);

      let newMigrationFiles = [];

      for (let migrationDirectory of walkSync("./db/migrate")) {
        const migrationDirectoryName = migrationDirectory.name;
        const timestamp = parseInt(migrationDirectoryName.split("-")[0]);

        if (pastMigrations.includes(timestamp)) continue;

        newMigrationFiles.push(migrationDirectoryName);

        const sql = await readFileStrSync(
          `./db/migrate/${migrationDirectoryName}/up.sql`,
          { encoding: "utf8" },
        );

        await db.query(sql);

        await db.query(
          "INSERT INTO \"migrations\" (ts, created_at) VALUES (timezone('utc', to_timestamp($1)), now())",
          [timestamp],
        );
      }

      console.log("Migrated: ", [""].concat(newMigrationFiles).join("\n\t"));

      console.log("Migration complete!");
    });
  },
  rollback: async () => {
    console.log("Rolling back last migration ...");

    transaction(initDB(), async (db) => {
      let lastMigration 
      for(lastMigration of walkSync("./db/migrate"));
      if(!lastMigration) throw {message: 'No migration files found'};
      const lastMigrationName = lastMigration.name;

      const timestamp = parseInt(lastMigrationName.split("-")[0]);

      const sql = readFileStrSync(
        `./db/migrate/${lastMigrationName}/down.sql`,
        { encoding: "utf8" },
      );

      await db.query(sql);

      await db.query(
        "DELETE FROM \"migrations\" WHERE ts = timezone('utc', to_timestamp($1))",
        [timestamp],
      );

      console.log("Rolled back: ", lastMigrationName);
    });
  },
  generate: async (options: Array<string>) => {
    transaction(initDB(), async (db) => {
      type Subcommand = "migration" | "model";

      const subcommands = {
        //TODO impletement
        model: async () => {},
        migration: async (migrationName: string) => {
          if (!migrationName) {
            throw { message: "USAGE: node db generate migration FILENAME" };
          }

          const now = (await db.query(
            "SELECT EXTRACT(EPOCH from timezone('utc', now()))::integer as ts",
          )).rows[0].ts;

          const migrationDirectory = `./db/migrate/${now}-${migrationName}`;

          await Deno.mkdir(migrationDirectory, { recursive: true });
          writeFileStrSync(`${migrationDirectory}/up.sql`, "");
          writeFileStrSync(`${migrationDirectory}/down.sql`, "");

          console.log(`Created migration files for ${migrationDirectory}`);
        },
      };

      const subcommand = options[0] as Subcommand;

      if (!subcommands[subcommand]) {
        throw { message: "USAGE: node db generate [migration] [options]" };
      }

      await subcommands[subcommand](options[1]);
    });
  },
  seed: async () => {
    console.log("Running seeds...");

    transaction(initDB(), async (db) => {
      const sql = readFileStrSync(`./db/seeds.sql`, { encoding: "utf8" });

      await db.query(sql);

      console.log("Seeds generated!");
    });
  },
};
