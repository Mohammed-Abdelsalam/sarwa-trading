import { z } from 'zod';

// Each object schema probes new Function() when built; the apps' CSP (no 'unsafe-eval') reports it.
z.config({ jitless: true });
