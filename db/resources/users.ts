import { Model } from "./model.ts";
import { Pool } from "https://deno.land/x/postgres/mod.ts";
import { Queries, dbResultToJSON } from "../core/queries.ts";

export const usersModel = {
  users: {
    model: {
      ...Model,
      name: "",
      age: 0,
    },
    update: (db: Pool, queries: Queries) => ({
      GET: {
        namesWithJ: async () => {
          console.log("All users", await queries("users").GET());
          const result = await db.query(
            "SELECT * FROM \"users\" WHERE name LIKE '%J%'",
          );
          return { status: 200, data: dbResultToJSON(result) };
        },
      },
    }),
  },
};
