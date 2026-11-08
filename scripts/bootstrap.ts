import { existsSync } from 'node:fs';
import { Store } from '../src/server/db';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const store = new Store(process.env.DATABASE_PATH || './data/finpilot-demo.sqlite');
store.close();
console.log('Backend migrations applied.');
