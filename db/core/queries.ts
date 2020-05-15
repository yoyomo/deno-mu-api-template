import { QueryResult } from "https://deno.land/x/postgres/query.ts";
import { initDB } from "./commands.ts";

export type AllowedMethods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export default {
  connect: (tables: { [k: string]: any }) => {
    const db = initDB();

    return (table: string) => {
      if (!tables[table]) throw { message: `Table "${table}" does not exist.` };
      return async (method: AllowedMethods, { id }: any, data?: any) => {
        switch (method) {
          case "GET": {
            let result: QueryResult;
            if (id) {
              result = await db.query(
                'SELECT * FROM "' + table + '" WHERE id = $1 LIMIT 1',
                [id],
              );
            } else {
              result = await db.query(
                'SELECT * FROM "' + table + '" ORDER BY id ASC',
              );
            }
            return { status: 200, data: result.rows };
          }
          case "DELETE": {
            const result = await db.query(
              `DELETE FROM "${table}" WHERE id = $1 RETURNING *`,
              [id],
            );
            return { status: 200, data: result.rows };
          }
          case "POST": {
            let sql = `INSERT INTO "${table}" (`;
            let sqlValues = " VALUES (";
            let inputs: string[] = [];
            Object.keys(data).map((attr, i) => {
              if (!(attr in tables[table])) {
                throw {
                  message: `Invalid parameter: "${attr}" in table "${table}"`,
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

            const result = await db.query(sql, inputs);
            return { status: 201, data: result.rows };
          }
          case "PUT":
          case "PATCH": {
            let sql = `UPDATE "${table}" SET`;
            let inputs = [];
            Object.keys(data).map((attr, i) => {
              if (!(attr in tables[table])) {
                throw {
                  message: `Invalid parameter: "${attr}" in table "${table}"`,
                };
              }

              if (i > 0) {
                sql += ",";
              }
              sql += ` ${attr} = $${i + 1}`;
              inputs.push(data[attr]);
            });
            sql += ` WHERE id = $${inputs.length + 1} RETURNING *`;
            inputs.push(id);

            const result = await db.query(sql, inputs);
            return { status: 200, data: result.rows };
          }
        }
      };
    };
  },
};
