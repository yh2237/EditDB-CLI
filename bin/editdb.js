#!/usr/bin/env node
import { main } from '../src/index.js';

main().catch((err) => {
  console.error('\nAn unexpected error has occurred:', err);
  process.exit(1);
});
