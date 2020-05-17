import { Pool } from "https://deno.land/x/postgres/mod.ts";

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

      for (let migrationDirectory of Deno.readDirSync("./db/migrate")) {
        const migrationDirectoryName = migrationDirectory.name;
        const timestamp = parseInt(migrationDirectoryName.split("-")[0]);

        if (pastMigrations.includes(timestamp)) continue;

        newMigrationFiles.push(migrationDirectoryName);

        const sql = await Deno.readTextFileSync(
          `./db/migrate/${migrationDirectoryName}/up.sql`,
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
      let lastMigration;
      for (lastMigration of Deno.readDirSync("./db/migrate"));
      if (!lastMigration) throw { message: "No migration files found" };
      const lastMigrationName = lastMigration.name;

      const timestamp = parseInt(lastMigrationName.split("-")[0]);

      const sql = Deno.readTextFileSync(
        `./db/migrate/${lastMigrationName}/down.sql`,
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

      const generateMigration = async (
        migrationName: string,
        upSQL = "",
        downSQL = "",
      ) => {
        if (!migrationName) {
          throw { message: "USAGE: node db generate migration FILENAME" };
        }

        const now = (await db.query(
          "SELECT EXTRACT(EPOCH from timezone('utc', now()))::integer as ts",
        )).rows[0].ts;

        const migrationDirectory = `./db/migrate/${now}-${migrationName}`;

        Deno.mkdirSync(migrationDirectory, { recursive: true });
        Deno.writeTextFileSync(`${migrationDirectory}/up.sql`, upSQL);
        Deno.writeTextFileSync(`${migrationDirectory}/down.sql`, downSQL);

        console.log(`Created migration files for ${migrationDirectory}`);
      };

      const subcommands = {
        migration: generateMigration,
        model: async (modelName: string) => {
          if (!modelName) {
            throw { message: "USAGE: node db generate model MODEL_NAME" };
          }

          if (Deno.readTextFileSync(`./db/resources/${modelName}.ts`)) {
            throw { message: `Resource ${modelName} already exists.` };
          }

          const upSQL = `CREATE TABLE "${modelName}" (\n` +
            `  id SERIAL,\n` +
            `  created_at timestamp default timezone('utc',now()),\n` +
            `  updated_at timestamp default timezone('utc',now())\n` +
            `)` +
            ``;
          const downSQL = `DROP TABLE "${modelName}";`;
          const migrationName = `create_${modelName}`;
          await generateMigration(migrationName, upSQL, downSQL);

          Deno.writeTextFileSync(
            `./db/resources/${modelName}.ts`,
            `${"import {Model} from './model.ts';"}\n\n` +
              `export const ${modelName}Model = {\n` +
              `  ${modelName}: {\n` +
              `    model: {\n` +
              `      ...Model,\n` +
              `    },\n` +
              `    update: (db: Pool, queries: Queries) => ({\n` +
              `    })\n` +
              `  }\n` +
              `}`,
          );

          console.log(
            `Generated model templates for ${modelName}.\n` +
              `now you can go edit the new migration files under ./db/migrate\n` +
              `and the new resource file under ./db/resources\n` +
              `according to the model specs!\n\n` +
              `Note:\n` +
              `\tYou must run the migrations yourself,\n` +
              `\t& include the new resource variable inside the 'models' under ./db/resources/index.ts`,
          );
        },
      };

      const subcommand = options[0] as Subcommand;

      if (!subcommands[subcommand]) {
        throw {
          message: "USAGE: node db generate [migration|model] [options]",
        };
      }

      await subcommands[subcommand](options[1]);
    });
  },
  seed: async () => {
    console.log("Running seeds...");

    transaction(initDB(), async (db) => {
      const sql = Deno.readTextFileSync(`./db/seeds.sql`);

      await db.query(sql);

      console.log("Seeds generated!");
    });
  },
};
