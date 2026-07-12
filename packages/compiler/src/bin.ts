#!/usr/bin/env node
/** Executable entry for `dotui`. All logic lives in cli.ts so it can be unit-tested. */

import { run } from './cli';

process.exitCode = run(process.argv.slice(2));
