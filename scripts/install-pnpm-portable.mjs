import { spawnSync } from 'node:child_process';
if(!process.env.npm_execpath) throw new Error('Run with pnpm run install:ci');
const result=spawnSync(process.execPath,[process.env.npm_execpath,'install','--frozen-lockfile'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status ?? 1);
