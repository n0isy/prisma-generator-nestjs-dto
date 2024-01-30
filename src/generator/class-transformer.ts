import { DMMF } from '@prisma/generator-helper';
import { IClassTransformer, ParsedField } from './types';

const transformersWithoutParams = ['Exclude', 'Expose'];

const transformersWithParams = new Map<string, string>([
  ['Type', ''],
  ['Transform', ''],
]);

const allTransformers = [
  ...transformersWithoutParams,
  ...transformersWithParams.keys(),
];

function extractTransformer(
  field: DMMF.Field,
  prop: string,
): IClassTransformer | null {
  const regexp = new RegExp(`@${prop}(.*)?\s*$`, 'm');
  const matches = regexp.exec(field.documentation || '');
  if (matches) {
    return {
      name: prop,
      value: matches[1].slice(1, -1),
    };
  }

  return null;
}

/**
 * Parse all types of class transformers.
 */
export function parseClassTransformers(field: DMMF.Field): IClassTransformer[] {
  const transformers: IClassTransformer[] = [];
  for (const prop of allTransformers) {
    const transformer = extractTransformer(field, prop);
    if (transformer) {
      // remove any auto-generated transformer in favor of user-defined transformer
      const index = transformers.findIndex((v) => v.name === transformer.name);
      if (index > -1) transformers.splice(index, 1);

      transformers.push(transformer);
    }
  }

  return transformers;
}

/**
 * Compose `class-transformer` decorators.
 */
export function decorateClassTransformers(field: ParsedField): string {
  if (!field.classTransformers?.length) return '';

  let output = '';

  field.classTransformers.forEach((prop) => {
    output += `@${prop.name}(${prop.value ? prop.value : ''})\n`;
  });

  return output;
}
