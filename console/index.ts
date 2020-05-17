import dbCommands from "../db/core/commands.ts";
import DB from "../db/core/queries.ts";

import { models } from "../db/resources/index.ts";

const db = DB.connect(models);

let console = Deno.repl.start({ prompt: "% " });

console.context.dbCommands = dbCommands;
console.context.models = models;
console.context.db = db;

console.setupHistory("./console/.history", () => {});
