import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.dev.vars')){console.log('Local secrets already exist. Not overwritten.');process.exit(0)}
writeFileSync('.dev.vars','BOOTSTRAP_TOKEN='+randomBytes(32).toString('hex')+'\n',{mode:0o600});
console.log('Generated a private .dev.vars file. Use BOOTSTRAP_TOKEN at /admin/login to create your first administrator. Never commit or publish this file.');
