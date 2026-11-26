// Writes the generated CSS next to the JS build. Runs after `tsup` (see package.json "build").
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const { buildWebThemeCss, buildNativeThemeCss } = require(join(dist, 'index.js'));

writeFileSync(join(dist, 'theme.css'), buildWebThemeCss());
writeFileSync(join(dist, 'native.css'), buildNativeThemeCss());
console.log('[tokens] wrote dist/theme.css and dist/native.css');
