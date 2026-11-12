function getDescription(schema) {
  return schema?.description || schema?._def?.description;
}

function unwrapSchema(schema) {
  let current = schema;
  let optional = false;
  let nullable = false;

  while (current?._def) {
    const typeName = current._def.typeName;

    if (typeName === "ZodOptional") {
      optional = true;
      current = current._def.innerType;
      continue;
    }

    if (typeName === "ZodNullable") {
      nullable = true;
      current = current._def.innerType;
      continue;
    }

    if (typeName === "ZodDefault") {
      optional = true;
      current = current._def.innerType;
      continue;
    }

    if (typeName === "ZodCatch") {
      current = current._def.innerType;
      continue;
    }

    if (typeName === "ZodEffects") {
      current = current._def.schema;
      continue;
    }

    if (typeName === "ZodBranded") {
      current = current._def.type;
      continue;
    }

    if (typeName === "ZodReadonly") {
      current = current._def.innerType;
      continue;
    }

    break;
  }

  return { schema: current, optional, nullable };
}

function withNullable(baseSchema, nullable, description) {
  let schema = baseSchema;

  if (nullable) {
    schema = {
      anyOf: [baseSchema, { type: "null" }],
    };
  }

  if (description && !schema.description) {
    schema.description = description;
  }

  return schema;
}

function convertStringSchema(schema) {
  const jsonSchema = { type: "string" };

  for (const check of schema._def.checks || []) {
    if (check.kind === "min") jsonSchema.minLength = check.value;
    if (check.kind === "max") jsonSchema.maxLength = check.value;
    if (check.kind === "regex" && check.regex) {
      jsonSchema.pattern = check.regex.source;
    }
    if (check.kind === "email") jsonSchema.format = "email";
    if (check.kind === "url") jsonSchema.format = "uri";
    if (check.kind === "datetime") jsonSchema.format = "date-time";
    if (check.kind === "date") jsonSchema.format = "date";
  }

  return jsonSchema;
}

function convertNumberSchema(schema) {
  const jsonSchema = { type: "number" };

  for (const check of schema._def.checks || []) {
    if (check.kind === "int") jsonSchema.type = "integer";
    if (check.kind === "min") jsonSchema.minimum = check.value;
    if (check.kind === "max") jsonSchema.maximum = check.value;
  }

  return jsonSchema;
}

function convertLiteralSchema(schema) {
  const value = schema._def.value;

  if (value === null) return { type: "null" };

  if (typeof value === "string") {
    return { type: "string", enum: [value] };
  }

  if (typeof value === "number") {
    return {
      type: Number.isInteger(value) ? "integer" : "number",
      enum: [value],
    };
  }

  if (typeof value === "boolean") {
    return { type: "boolean", enum: [value] };
  }

  return {};
}

function convertObjectSchema(schema) {
  const shape = typeof schema.shape === "function" ? schema.shape() : schema.shape;
  const properties = {};
  const required = [];
  const propertyOrdering = [];

  for (const [key, childSchema] of Object.entries(shape || {})) {
    const converted = convertZodNode(childSchema);
    properties[key] = converted.schema;
    propertyOrdering.push(key);

    if (!converted.optional) {
      required.push(key);
    }
  }

  const jsonSchema = {
    type: "object",
    properties,
    propertyOrdering,
  };

  if (required.length > 0) {
    jsonSchema.required = required;
  }

  const catchall = schema?._def?.catchall;
  if (catchall && catchall?._def?.typeName !== "ZodNever") {
    jsonSchema.additionalProperties = convertZodNode(catchall).schema;
  } else {
    jsonSchema.additionalProperties = schema?._def?.unknownKeys === "passthrough";
  }

  return jsonSchema;
}

function convertNativeEnumSchema(schema) {
  const values = Object.values(schema._def.values || {}).filter(
    (value) => typeof value === "string" || typeof value === "number",
  );

  const hasOnlyNumbers = values.every((value) => typeof value === "number");
  const hasOnlyStrings = values.every((value) => typeof value === "string");

  if (hasOnlyNumbers) {
    return {
      type: values.every(Number.isInteger) ? "integer" : "number",
      enum: values,
    };
  }

  if (hasOnlyStrings) {
    return {
      type: "string",
      enum: values,
    };
  }

  return {};
}

function convertBaseSchema(schema) {
  const typeName = schema?._def?.typeName;

  switch (typeName) {
    case "ZodString":
      return convertStringSchema(schema);
    case "ZodNumber":
      return convertNumberSchema(schema);
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: schema._def.values };
    case "ZodNativeEnum":
      return convertNativeEnumSchema(schema);
    case "ZodLiteral":
      return convertLiteralSchema(schema);
    case "ZodArray": {
      const jsonSchema = {
        type: "array",
        items: convertZodNode(schema._def.type).schema,
      };

      if (schema._def.minLength?.value !== undefined) {
        jsonSchema.minItems = schema._def.minLength.value;
      }

      if (schema._def.maxLength?.value !== undefined) {
        jsonSchema.maxItems = schema._def.maxLength.value;
      }

      return jsonSchema;
    }
    case "ZodObject":
      return convertObjectSchema(schema);
    case "ZodUnion":
      return {
        anyOf: schema._def.options.map((option) => convertZodNode(option).schema),
      };
    case "ZodDiscriminatedUnion":
      return {
        anyOf: schema._def.options.map((option) => convertZodNode(option).schema),
      };
    case "ZodRecord":
      return {
        type: "object",
        additionalProperties: convertZodNode(schema._def.valueType).schema,
      };
    case "ZodAny":
    case "ZodUnknown":
      return {};
    case "ZodNull":
      return { type: "null" };
    case "ZodDate":
      return { type: "string", format: "date-time" };
    default:
      throw new Error(`Unsupported Zod schema type: ${typeName}`);
  }
}

function convertZodNode(schema) {
  const description = getDescription(schema);
  const { schema: unwrappedSchema, optional, nullable } = unwrapSchema(schema);
  const baseSchema = convertBaseSchema(unwrappedSchema);

  return {
    schema: withNullable(baseSchema, nullable, description),
    optional,
  };
}

function zodToJsonSchema(schema) {
  return convertZodNode(schema).schema;
}

module.exports = { zodToJsonSchema };
