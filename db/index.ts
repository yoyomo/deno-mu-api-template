import dbCommands from "./core/commands.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";

type COMMANDS = 'init' | 'uninit' | 'create' | 'drop' | 'migrate' |'generate' | 'rollback' | 'seed';

const args = parse(Deno.args)._;
const command = args[0] as COMMANDS;
const params = args.slice(1) as string[];

if (!command) {
  console.warn(
    "USAGE: node db [init|uninit|create|drop|migrate|generate|rollback|seed] [options]",
  );
  Deno.exit(1);
}

dbCommands[command](params);
