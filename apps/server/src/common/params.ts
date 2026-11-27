import { Param } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe';

export const IdParam = () => Param('id', new ZodValidationPipe(z.string().min(1).max(64)));
