# MU-API
Model Update API template for deno

Modular API using postgresql and nodejs. What I love about rails's easy database setup and development, now in deno. So, there is no need to even use `psql` with these sets of commands. Everything should be as simple and clean as `./db.sh create`.

## Getting started

```bash
git clone git@github.com:yoyomo/deno-mu-api-template.git mu-api
cd mu-api
deno run --allow-env --allow-net index.ts
```

### Requirements
- Postgresql: 
```bash
brew install postgresql
brew services start postgresql
```

Deno:
```bash
brew install deno
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

Note:
`./db.sh` is just an abbreviation for `deno run --allow-env --allow-net db/index.ts`. You can use it either way.

```bash
./db.sh init # creates a user in pg
./db.sh create # creates a dabatase
./db.sh migrate # runs a migration for directories under db/migrate/[timestamp]-*/up.sql
./db.sh seed # runs the seeds file under ./db/seed.sql
```

#### Generate Migrations
```bash
./db.sh generate migration create_notes
```
or better yet,
```bash
./db.sh generate model notes
```

and then edit the generated SQL file under `db/migrate` and the resource file under `./db/resources/notes.ts`. Now `./db.sh migrate` should do something!

#### Undo's
```bash
./db.sh rollback # undos last migration under db/migrate/[timestamp]-*/down.sql
./db.sh drop # drops database
./db.sh uninit # deletes user
```

### Console
A custom console that has access to the database functions is available through:
```bash
./console.sh
```
