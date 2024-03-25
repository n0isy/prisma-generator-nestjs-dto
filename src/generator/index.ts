import path from 'node:path';
import { camel, pascal, kebab, snake } from 'case';
import { DMMF } from '@prisma/generator-helper';
import { logger } from '../utils';
import { generateEnums } from './generate-enums';
import { makeHelpers } from './template-helpers';
import { computeModelParams } from './compute-model-params';
import { computeTypeParams } from './compute-type-params';
import { generateConnectDto } from './generate-connect-dto';
import { generateCreateDto } from './generate-create-dto';
import { generateUpdateDto } from './generate-update-dto';
import { generateEntity } from './generate-entity';
import { generatePlainDto } from './generate-plain-dto';
import { DTO_IGNORE_MODEL } from './annotations';
import { isAnnotatedWith } from './field-classifiers';
import { NamingStyle, Model, WriteableFileSpecs } from './types';

interface RunParam {
  output: string;
  dmmf: DMMF.Document;
  exportRelationModifierClasses: boolean;
  outputToNestJsResourceStructure: boolean;
  flatResourceStructure: boolean;
  connectDtoPrefix: string;
  createDtoPrefix: string;
  updateDtoPrefix: string;
  dtoSuffix: string;
  entityPrefix: string;
  entitySuffix: string;
  fileNamingStyle: NamingStyle;
  classValidation: boolean;
  classTransformer: boolean;
  outputType: string;
  noDependencies: boolean;
  definiteAssignmentAssertion: boolean;
  requiredResponseApiProperty: boolean;
  prismaClientImportPath: string;
  updatedEnabled: boolean;
  connectedEnabled: boolean;
  entityEnabled: boolean;
  createdEnabled: boolean;
  alwaysHidden: string[];
  alwaysReadonly: string[];
}

export const run = ({
  output,
  dmmf,
  ...options
}: RunParam): WriteableFileSpecs[] => {
  const {
    exportRelationModifierClasses,
    outputToNestJsResourceStructure,
    flatResourceStructure,
    fileNamingStyle = 'camel',
    classValidation,
    classTransformer,
    outputType,
    noDependencies,
    definiteAssignmentAssertion,
    requiredResponseApiProperty,
    prismaClientImportPath,
    updatedEnabled,
    connectedEnabled,
    entityEnabled,
    createdEnabled,
    alwaysHidden,
    alwaysReadonly,
    ...preAndSuffixes
  } = options;

  const transformers: Record<NamingStyle, (str: string) => string> = {
    camel,
    kebab,
    pascal,
    snake,
  };

  const transformFileNameCase = transformers[fileNamingStyle];

  const templateHelpers = makeHelpers({
    transformFileNameCase,
    transformClassNameCase: pascal,
    classValidation,
    classTransformer,
    outputType,
    noDependencies,
    definiteAssignmentAssertion,
    prismaClientImportPath,
    requiredResponseApiProperty,
    updatedEnabled,
    connectedEnabled,
    entityEnabled,
    createdEnabled,
    alwaysHidden,
    alwaysReadonly,
    ...preAndSuffixes,
  });
  const allModels = dmmf.datamodel.models;

  const filteredTypes: Model[] = dmmf.datamodel.types
    .filter((model) => !isAnnotatedWith(model, DTO_IGNORE_MODEL))
    .map((model: DMMF.Model) => ({
      ...model,
      output: {
        dto: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'dto')
          : output,
        entity: '',
      },
    }));

  const filteredModels: Model[] = allModels
    .filter((model) => !isAnnotatedWith(model, DTO_IGNORE_MODEL))
    // adds `output` information for each model, so we can compute relative import paths
    // this assumes that NestJS resource modules (more specifically their folders on disk) are named as `transformFileNameCase(model.name)`
    .map((model) => ({
      ...model,
      type: 'model',
      output: {
        dto: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'dto')
          : output,
        entity: outputToNestJsResourceStructure
          ? flatResourceStructure
            ? path.join(output, transformFileNameCase(model.name))
            : path.join(output, transformFileNameCase(model.name), 'entities')
          : output,
      },
    }));

  const typeFiles = filteredTypes.map((model) => {
    logger(`Processing Type ${model.name}`);

    const typeParams = computeTypeParams({
      model,
      allModels: filteredTypes,
      templateHelpers,
    });
    // generate create-model.dto.ts
    const createDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.createDtoFilename(model.name, true),
      ),
      content: generateCreateDto({
        ...typeParams.create,
        exportRelationModifierClasses,
        templateHelpers,
      }),
    };

    // generate update-model.dto.ts
    const updateDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.updateDtoFilename(model.name, true),
      ),
      content: generateUpdateDto({
        ...typeParams.update,
        exportRelationModifierClasses,
        templateHelpers,
      }),
    };

    // generate model.dto.ts
    const plainDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.plainDtoFilename(model.name, true),
      ),
      content: generatePlainDto({
        ...typeParams.plain,
        templateHelpers,
      }),
    };

    return [createDto, updateDto, plainDto];
  });

  const modelFiles = filteredModels.map((model) => {
    const models: any[] = [];

    logger(`Processing Model ${model.name}`);

    const modelParams = computeModelParams({
      model,
      allModels: [...filteredTypes, ...filteredModels],
      templateHelpers,
    });
    if (connectedEnabled) {
      // generate connect-model.dto.ts
      const connectDto = {
        fileName: path.join(
          model.output.dto,
          templateHelpers.connectDtoFilename(model.name, true),
        ),
        content: generateConnectDto({
          ...modelParams.connect,
          exportRelationModifierClasses,
          templateHelpers,
        }),
      };
      models.push(connectDto);
    }
    if (createdEnabled) {
      // generate create-model.dto.ts
      const createDto = {
        fileName: path.join(
          model.output.dto,
          templateHelpers.createDtoFilename(model.name, true),
        ),
        content: generateCreateDto({
          ...modelParams.create,
          exportRelationModifierClasses,
          templateHelpers,
        }),
      };
      models.push(createDto);
    }
    // TODO generate create-model.struct.ts
    if (updatedEnabled) {
      // generate update-model.dto.ts
      const updateDto = {
        fileName: path.join(
          model.output.dto,
          templateHelpers.updateDtoFilename(model.name, true),
        ),
        content: generateUpdateDto({
          ...modelParams.update,
          exportRelationModifierClasses,
          templateHelpers,
        }),
      };
      models.push(updateDto);
      // TODO generate update-model.struct.ts
    }

    if (entityEnabled) {
      // generate model.entity.ts
      const entity = {
        fileName: path.join(
          model.output.entity,
          templateHelpers.entityFilename(model.name, true),
        ),
        content: generateEntity({
          ...modelParams.entity,
          templateHelpers,
        }),
      };
      models.push(entity);
    }
    // TODO generate model.struct.ts

    // generate model.dto.ts
    const plainDto = {
      fileName: path.join(
        model.output.dto,
        templateHelpers.plainDtoFilename(model.name, true),
      ),
      content: generatePlainDto({
        ...modelParams.plain,
        templateHelpers,
      }),
    };

    return [plainDto, ...models];
  });

  const enums: DMMF.DatamodelEnum[] = dmmf.datamodel.enums;

  const enumFiles: any[] = [];
  if (enums.length > 0 && noDependencies) {
    enumFiles.push({
      fileName: path.join(output, 'enums.ts'),
      content: generateEnums({ enums, templateHelpers }),
    });
  }

  return [...typeFiles, ...modelFiles, ...enumFiles].flat();
};
