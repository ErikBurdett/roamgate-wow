import path from 'node:path';
import { validateConfig } from '../bridge/config.mjs';

export function installOptions(args, saved) {
  const flags = new Set(['--help','--install','--service','--read-only','--interactive']);
  const values = new Set(['--stage','--addon-dir','--slots','--origin']);
  const options = {};
  for (let i=0;i<args.length;i++) {
    const key=args[i];
    if (Object.hasOwn(options,key)) throw Error(`Repeated option: ${key}`);
    if (flags.has(key)) options[key]=true;
    else if (values.has(key)) {
      const value=args[++i];
      if (!value || value.startsWith('--')) throw Error(`Missing value for ${key}`);
      options[key]=value;
    } else throw Error(`Unknown option: ${key}. Use --help.`);
  }
  if (options['--read-only'] && options['--interactive']) throw Error('Choose either --read-only or --interactive');
  if (options['--stage'] && (options['--install'] || options['--service'] || options['--addon-dir'])) throw Error('--stage cannot be combined with --install, --service or --addon-dir');
  if (options['--addon-dir'] && !path.isAbsolute(options['--addon-dir'])) throw Error('--addon-dir requires an absolute path');
  const config=validateConfig({...saved,
    ...(options['--stage'] ? {addonDir:path.resolve(options['--stage'])} : options['--addon-dir'] ? {addonDir:options['--addon-dir']} : {}),
    ...(options['--slots'] ? {slots:Number(options['--slots'])} : {}),
    ...(options['--origin'] ? {origin:options['--origin']} : {}),
    ...(options['--read-only'] ? {mode:'read-only'} : options['--interactive'] ? {mode:'interactive'} : {}),
  });
  return {config,stage:!!options['--stage'],install:!!options['--install'],service:!!options['--service']};
}
export const HELP = `Usage: node scripts/install.mjs [options]

With no --install, prints a plan and changes nothing (except --stage).
Updates preserve the saved path, slot count, mode and Roamgate origin.

  --addon-dir PATH   Absolute path to this client's existing Interface/AddOns
  --install          Install/update the addon and save companion configuration
  --service          With --install, enable/restart only the WoW companion
  --origin URL       Local Roamgate HTTP origin (default http://127.0.0.1:8787)
  --slots N          16–4096 update slots (default 2048)
  --read-only        Disable sending, new chats and approvals
  --interactive      Explicitly enable actions again
  --stage PATH       Generate test/build addon files only; no service or config
  --help             Show this help

See docs/SETUP.md for prerequisites, first launch and updates.
`;
