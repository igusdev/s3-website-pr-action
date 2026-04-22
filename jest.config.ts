import type { Config } from 'jest';
import { createDefaultEsmPreset } from 'ts-jest';

const presetConfig = createDefaultEsmPreset({
  tsconfig: './tsconfig.spec.json',
});

export default {
  ...presetConfig,
} satisfies Config;
