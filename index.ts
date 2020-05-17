import { serve } from "https://deno.land/std/http/server.ts";
import { decode } from "https://deno.land/std/encoding/utf8.ts";

import db, { AllowedMethods } from "./db/core/queries.ts";
import colors from "./utils/colors.ts";

import { models } from "./db/resources/index.ts";

import { Response } from "./db/core/queries.ts";
const ENV = Deno.env.toObject();

const PORT = parseInt(ENV.PORT) || 1234;

const parseURL = (url: string) => {
  let [pathname, queryString] = url.split("?");

  let query: { [k: string]: string } = {};

  if (queryString) {
    queryString.split(",").map((param) => {
      const [key, value] = param.split("=");
      query[key] = value;
    });
  }

  return { pathname, query };
};

const main = async () => {
  const query = db.connect(models);

  const s = serve({ port: PORT });
  console.log(
    `${colors.bright}server listening at port ${PORT}${colors.reset}`,
  );
  for await (const req of s) {
    const url = parseURL(req.url);
    const method = req.method as AllowedMethods;

    let response: Response = {
      status: 404,
      error: "Page not found",
    };

    try {
      const data = JSON.parse(decode(await Deno.readAll(req.body)) || "{}");

      const path = url.pathname.match(/\/([a-z]+)(\/[0-9]+)?(\/[a-zA-Z]+)?/);

      if (!path) throw { message: "path not found" };

      const model = path[1];
      const id = path[2] && path[2].split("/")[1];
      const update = path[3] && path[3].split("/")[1];

      if (update) {
        response = await query(model).update()[method][update](
          { ...url.query, id: id },
          data,
        );
      } else {
        response = await query(model)[method](
          { ...url.query, id: id },
          data,
        );
      }
    } catch (error) {
      console.error(error);
      response = { status: 500, error: error.message };
    }

    console.log(
      `${colors.cyan}%s${colors.reset} %s %s %O`,
      new Date(),
      method,
      url.pathname,
      response,
    );

    req.respond({ status: response.status, body: JSON.stringify(response) });
  }
};

main();
