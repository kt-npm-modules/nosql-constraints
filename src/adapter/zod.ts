import {
	ZodAny,
	ZodArray,
	ZodBoolean,
	ZodDate,
	ZodDefault,
	ZodDiscriminatedUnion,
	ZodEnum,
	ZodLiteral,
	ZodNumber,
	ZodObject,
	ZodOptional,
	ZodString,
	ZodType,
	ZodUnion
} from 'zod';
import { DocumentSchemaAdapter, DocumentSchemaChunk, DocumentSchemaChunkType } from './schema';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _DocumentSchemaChunkType2ZodType: { [key: string]: any } = {
	string: ZodString,
	number: ZodNumber,
	boolean: ZodBoolean,
	date: ZodDate,
	any: ZodAny
};

export function zod(schema: ZodType): DocumentSchemaAdapter {
	return new ZodAdapter(schema);
}

class ZodAdapter implements DocumentSchemaAdapter {
	readonly #schema: ZodType;
	constructor(schema: ZodType) {
		this.#schema = schema;
	}
	extractChunks(): DocumentSchemaChunk[] {
		return extractChunks(undefined, undefined, this.#schema)[1];
	}
}

function extractChunks(
	propertyKey: string | undefined,
	propertyPath: string | undefined,
	schema: ZodType
): [string | undefined, DocumentSchemaChunk[]] {
	// Handle null/undefined schema
	if (!schema) {
		throw new Error(`Schema is null or undefined at ${propertyPath} with key ${propertyKey}`);
	}

	// First check primitive types
	for (const primitiveType of Object.keys(_DocumentSchemaChunkType2ZodType)) {
		const zodType = _DocumentSchemaChunkType2ZodType[primitiveType];
		if (schema instanceof zodType) {
			return [
				propertyKey,
				[{ path: propertyPath, type: primitiveType as DocumentSchemaChunkType }]
			];
		}
	}
	if (schema instanceof ZodUnion || schema instanceof ZodDiscriminatedUnion) {
		return [
			propertyKey,
			(schema.options as ZodType[])
				.map((option: ZodType) => extractChunks(propertyKey, propertyPath, option)[1])
				.flat()
		];
	} else if (schema instanceof ZodObject) {
		return [propertyKey, [extractChunkFromObject(propertyPath, schema)]];
	} else if (schema instanceof ZodLiteral) {
		return [propertyKey, [{ path: propertyPath, type: 'literal', value: schema.value }]];
	} else if (schema instanceof ZodArray) {
		return [
			propertyKey ? `${propertyKey}[]` : '[]',
			extractChunksFromArray(propertyKey, propertyPath, schema as ZodArray<ZodType>)
		];
	} else if (schema instanceof ZodOptional) {
		const [chunkPropertyKey, chunkPropertyValue] = extractChunks(
			propertyKey,
			propertyPath,
			schema.unwrap() as ZodType
		);
		return [chunkPropertyKey, chunkPropertyValue.map((chunk) => ({ ...chunk, optional: true }))];
	} else if (schema instanceof ZodEnum) {
		return [
			propertyKey,
			[
				{
					path: propertyPath,
					type: 'enum',
					value: schema.options
				}
			]
		];
	} else if (schema instanceof ZodDefault) {
		const [chunkPropertyKey, chunkPropertyValue] = extractChunks(
			propertyKey,
			propertyPath,
			schema.def.innerType as ZodType
		);
		return [
			chunkPropertyKey,
			chunkPropertyValue.map((chunk) => ({
				...chunk,
				default:
					typeof schema.def.defaultValue === 'function'
						? (schema.def.defaultValue as () => unknown)()
						: schema.def.defaultValue
			}))
		];
	} else if (schema.constructor?.name === 'ZodPipe') {
		// Handle ZodPipe (created by .transform() in Zod v4)
		const pipeSchema = schema as unknown as { def: Record<string, unknown> };
		const pipeDef = pipeSchema.def;

		// Try different possible properties for the input schema
		const inputSchema = pipeDef.left || pipeDef.in || pipeDef.input || pipeDef.schema;

		if (!inputSchema) {
			throw new Error(
				`ZodPipe input schema not found at ${propertyPath} with key ${propertyKey}. Available properties: ${Object.keys(pipeDef).join(', ')}`
			);
		}

		const [chunkPropertyKey, chunkPropertyValue] = extractChunks(
			propertyKey,
			propertyPath,
			inputSchema as ZodType
		);
		return [chunkPropertyKey, chunkPropertyValue];
	} else {
		throw new Error(
			`Unsupported schema type: ${schema.constructor?.name || 'Unknown'} at ${propertyPath} with key ${propertyKey}`
		);
	}
}

function extractChunkFromObject(
	propertyPath: string | undefined,
	schema: ZodObject<Record<string, ZodType>>
): DocumentSchemaChunk {
	const properties: Record<string, DocumentSchemaChunk[]> = {};
	for (const [key, value] of Object.entries(schema.shape)) {
		const _propertyPath = propertyPath ? `${propertyPath}.${key}` : key;
		const [chunkPropertyKey, chunkPropertyValue] = extractChunks(
			key,
			_propertyPath,
			value as ZodType
		);
		properties[chunkPropertyKey!] = chunkPropertyValue;
	}
	return {
		path: propertyPath,
		type: 'object',
		properties
	};
}

function extractChunksFromArray(
	propertyKey: string | undefined,
	propertyPath: string | undefined,
	schema: ZodArray<ZodType>
): DocumentSchemaChunk[] {
	const _propertyKey = propertyKey ? `${propertyKey}[]` : '[]';
	const _propertyPath = propertyPath ? `${propertyPath}[]` : '[]';
	const [, chunkPropertyValue] = extractChunks(_propertyKey, _propertyPath, schema.element);
	return chunkPropertyValue;
}
