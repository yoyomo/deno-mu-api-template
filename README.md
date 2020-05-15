# MU-API
Model Update API template for deno

Modular API using postgresql and nodejs. What I love about rails's easy database setup and development, now in deno. So, there is no need to even use `psql` with these sets of commands. Everything should be as simple and clean `deno run --allow-env --allow-net db/index.ts create`.

## Getting started

```bash
git clone git@github.com:yoyomo/deno-mu-api-template.git mu-api
cd mu-api
deno run --allow-env --allow-net --unstable index.ts
```

### Requirements
Postgresql: 
```bash
brew install postgresql
brew services start postgresql
```

### Basics
The Api basically works by using:
```ts
import db from './db/core/queries.ts';

const query = db.connect(tables);

response = await query(table)[method](url.query, data);

```

where `tables` is just an object that represents all the tables in the database, `table` is the table's name, `method` the request's method, `url.query` is the parsed query from the url, and `data` is any incoming json data.

A more clear example lies in `index.ts`

### Build the API
Environment variables in your `mu-api.env` file should reflect the ones defined in `mu-api.env.example`. In order for the following commands to work.
Or just run `source mu-api.env.example ` for now.

```bash
deno run --allow-env --allow-net db/index.ts init # creates a user in pg
deno run --allow-env --allow-net db/index.ts create # creates a dabatase
deno run --allow-env --allow-net db/index.ts migrate # runs a migration for directories under db/migrate/[timestamp]-*/up.sql
deno run --allow-env --allow-net db/index.ts seed # runs the seeds file under ./db/seed.sql
```

#### Generate Migrations
```bash
deno run --allow-env --allow-net db/index.ts generate migration create_users
```
and then edit the generated SQL file under `db/migrate`. Now `node db migrate` should do something!

#### Undo's
```bash
deno run --allow-env --allow-net db/index.ts rollback # undos last migration under db/migrate/[timestamp]-*/down.sql
deno run --allow-env --allow-net db/index.ts drop # drops database
deno run --allow-env --allow-net db/index.ts uninit # deletes user
```
