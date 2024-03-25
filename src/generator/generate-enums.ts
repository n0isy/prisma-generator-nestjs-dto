import { DMMF } from '@prisma/generator-helper';
import type { TemplateHelpers } from './template-helpers';

interface GenerateEnumsParam {
  enums: DMMF.DatamodelEnum[];
  templateHelpers: TemplateHelpers;
}
export const generateEnums = ({
  enums,
  templateHelpers: t,
}: GenerateEnumsParam) => `
${t.each(
  enums,
  (content) => `export enum ${content.name} {
${t.each(content.values, (value) => `  ${value.name} = '${value.name}'`, ',\n')}}`,
  '\n\n',
)}
`;
