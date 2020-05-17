import { QueryResult } from "https://deno.land/x/postgres/query.ts";
import { Pool } from "https://deno.land/x/postgres/mod.ts";
import { initDB } from "./commands.ts";

export type AllowedMethods = "GET" | "POST" | "PATCH" | "DELETE";

export const dbResultToJSON = (result: QueryResult) => {
  let json: { [k: string]: string }[] = [];
  result.rows.map((row) => {
    let obj: { [k: string]: string } = {};

    result.rowDescription.columns.map((el, i) => {
      obj[el.name] = row[i];
    });
    json.push(obj);
  });

  return json;
};

export type Response = { status: number; data?: any; error?: string };
export type Request = (params?: any, data?: any) => Promise<Response>;
export type GeneralQueries = {
  GET: Request;
  POST: Request;
  DELETE: Request;
  PATCH: Request;
};
export type Update = (db: Pool, queries: Queries) => Response;
export type Queries = (model: string) =>
  & GeneralQueries
  & {
    update: () => {
      GET: { [k: string]: Update };
      POST: { [k: string]: Update };
      PATCH: { [k: string]: Update };
      DELETE: { [k: string]: Update };
    };
  };

export default {
  connect: (models: { [k: string]: any }) => {
    const db = initDB();

    const queries = (model: string) => {
      if (!models[model]) throw { message: `Table "${model}" does not exist.` };
      const generalQueries: GeneralQueries = {
        GET: async (params) => {
          let result: QueryResult;
          if (params && params.id) {
            result = await db.query(
              'SELECT * FROM "' + model + '" WHERE id = $1 LIMIT 1',
              params.id,
            );
          } else {
            result = await db.query(
              'SELECT * FROM "' + model + '" ORDER BY id ASC',
            );
          }
          return { status: 200, data: dbResultToJSON(result) };
        },
        DELETE: async (params) => {
          const result = await db.query(
            `DELETE FROM "${model}" WHERE id = $1 RETURNING *`,
            params.id,
          );
          return { status: 200, data: dbResultToJSON(result) };
        },
        POST: async (_params: any, data: any) => {
          let sql = `INSERT INTO "${model}" (`;
          let sqlValues = " VALUES (";
          let inputs: string[] = [];
          Object.keys(data).map((attr, i) => {
            if (!(attr in models[model])) {
              throw {
                message: `Invalid parameter: "${attr}" in table "${model}"`,
              };
            }

            if (i > 0) {
              sql += ",";
              sqlValues += ",";
            }
            sql += ` ${attr}`;
            sqlValues += ` $${i + 1}`;
            inputs.push(data[attr]);
          });
          sql += ")";
          sqlValues += ")";
          sql += `${sqlValues} RETURNING *`;

          const result = await db.query(sql, ...inputs);
          return { status: 201, data: dbResultToJSON(result) };
        },
        PATCH: async (params, data?: any) => {
          let sql = `UPDATE "${model}" SET updated_at=timezone('utc', now())`;
          let inputs = [];
          Object.keys(data).map((attr, i) => {
            if (!(attr in models[model])) {
              throw {
                message: `Invalid parameter: "${attr}" in table "${model}"`,
              };
            }

            sql += ",";
            sql += ` ${attr} = $${i + 1}`;
            inputs.push(data[attr]);
          });
          sql += ` WHERE id = $${inputs.length + 1} RETURNING *`;
          inputs.push(params.id);

          const result = await db.query(sql, ...inputs);
          return { status: 200, data: dbResultToJSON(result) };
        },
      };

      return {
        update: () => models[model].update(db, queries),
        ...generalQueries,
      };
    };

    return queries;
  },
};
