#!/usr/bin/env node
/**
 * ticket-kit CLI — one command, four verbs:
 *
 *   ticket-kit serve              live board on the configured port
 *   ticket-kit generate           regenerate README index + board.html
 *   ticket-kit new "<title>"      scaffold a ticket (--priority --area --status)
 *   ticket-kit check              lint frontmatter (exit 1 on problems)
 *
 * Run from a project root that has (or will have) a tickets/ dir and an
 * optional .tickets.json.
 */

import { loadConfig } from './config.ts';
import { serve } from './serve.ts';
import { generate } from './generate.ts';
import { createTicket, type NewTicketOptions } from './new.ts';
import { checkTickets } from './check.ts';
import { migrate } from './migrate.ts';
import { KIT_VERSION, SCHEMA_VERSION } from './version.ts';

const HELP = `ticket-kit — markdown tickets with a live board

Usage:
  ticket-kit serve              Live board (polls the tickets dir every ~3s)
  ticket-kit generate           Regenerate README index + static board.html
  ticket-kit new "<title>"      Create a ticket
                                  --priority <P0..>  --area <name>  --status <key>
                                  --parent <ID>  (make it a subtask of <ID>)
  ticket-kit check              Validate frontmatter; exit 1 if any problems
  ticket-kit migrate            Upgrade tickets to the current data schema
  ticket-kit version            Print the kit + data-schema versions
  ticket-kit help               This message

Config: drop a .tickets.json at the project root to override ticketsDir, port,
idPrefix, priorities, columns, or title. All optional.`;

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string>;
}

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = args[++i] ?? '';
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function runNew(root: string, args: string[]): void {
  const config = loadConfig(root);
  const { positionals, flags } = parseArgs(args);
  const title = positionals.join(' ').trim();
  if (!title) {
    console.error('ticket-kit new: a title is required, e.g. ticket-kit new "fix the thing"');
    process.exit(1);
  }
  const opts: NewTicketOptions = { title };
  if (flags['priority']) opts.priority = flags['priority'];
  if (flags['area']) opts.area = flags['area'];
  if (flags['status']) opts.status = flags['status'];
  if (flags['parent']) opts.parent = flags['parent'];
  try {
    console.log(`✓ wrote ${createTicket(root, config, opts)}`);
  } catch (err) {
    console.error(`ticket-kit new: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function runCheck(root: string): void {
  const problems = checkTickets(root, loadConfig(root));
  if (problems.length === 0) {
    console.log('✓ all tickets valid');
    return;
  }
  for (const p of problems) console.error(`✗ ${p.file}: ${p.message}`);
  console.error(`\n${problems.length.toString()} problem(s)`);
  process.exit(1);
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2);
  const root = process.cwd();
  switch (cmd) {
    case 'serve':
      serve(root, loadConfig(root));
      break;
    case 'generate': {
      const { count } = generate(root, loadConfig(root));
      console.log(`✓ generated index + board for ${count.toString()} ticket(s)`);
      break;
    }
    case 'new':
      runNew(root, rest);
      break;
    case 'check':
      runCheck(root);
      break;
    case 'migrate': {
      const result = migrate(root, loadConfig(root));
      if (result.applied.length === 0) {
        console.log(`✓ tickets already at schema v${result.to.toString()} — nothing to migrate`);
      } else {
        for (const step of result.applied) console.log(`• ${step}`);
        console.log(`✓ migrated v${result.from.toString()} → v${result.to.toString()}`);
      }
      break;
    }
    case 'version':
      console.log(`ticket-kit ${KIT_VERSION} (data schema v${SCHEMA_VERSION.toString()})`);
      break;
    default:
      console.log(HELP);
  }
}

main();
