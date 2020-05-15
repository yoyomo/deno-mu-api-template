import { serve } from "https://deno.land/std/http/server.ts";

import db, { AllowedMethods } from "./db/core/queries.ts";
import colors from "./utils/colors.ts";

import { tables } from "./db/resources.ts";

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
  const query = db.connect(tables);

  const s = serve({ port: PORT });
  console.log(
    `${colors.bright}server listening at port ${PORT}${colors.reset}`,
  );
  for await (const req of s) {
    const url = parseURL(req.url);
    const method = req.method as AllowedMethods;

    let response: { status: number; data?: any; error?: string } = {
      status: 404,
      error: "Page not found",
    };

    try {
      const path = url.pathname.split("/");
      const table = path[1];
      const id = path[2];

      //TODO create routes for controllers/update

      response = await query(table)[method](
        { ...url.query, id: id },
        req.body,
      );
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
