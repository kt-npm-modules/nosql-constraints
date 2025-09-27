import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zod } from '../../src/index';

describe('Zod Adapter implementation', () => {
	describe('ZodObject', () => {
		it('should be able to extract simple ZodObject', () => {
			const schema = z.object({
				name: z.string(),
				age: z.number().optional(),
				someEnum: z
					.enum(['A', 'B', 'C'])
					.default('A')
					.transform((val) => val)
			});
			const adapter = zod(schema);
			const chunks = adapter.extractChunks();
			expect(chunks).toEqual([
				{
					path: undefined,
					type: 'object',
					properties: {
						name: [{ path: 'name', type: 'string' }],
						age: [{ path: 'age', type: 'number', optional: true }],
						someEnum: [
							{
								path: 'someEnum',
								type: 'enum',
								value: ['A', 'B', 'C'],
								default: 'A'
							}
						]
					}
				}
			]);
		});
		it('should be able to extract nested ZodObject', () => {
			const schema = z.object({
				user: z.object({
					name: z.string(),
					age: z.number()
				})
			});
			const adapter = zod(schema);
			const chunks = adapter.extractChunks();
			expect(chunks).toEqual([
				{
					type: 'object',
					path: undefined,
					properties: {
						user: [
							{
								type: 'object',
								path: 'user',
								properties: {
									name: [{ path: 'user.name', type: 'string' }],
									age: [{ path: 'user.age', type: 'number' }]
								}
							}
						]
					}
				}
			]);
		});
	});
	describe('ZodUnion', () => {
		it('should be able to extract simple ZodUnion', () => {
			const schema = z.union([
				z.object({
					type: z.literal('A'),
					name: z.string(),
					age: z.number(),
					someArray: z.string().array()
				}),
				z.object({
					type: z.literal('B'),
					firstname: z.string(),
					surname: z.string(),
					email: z.string()
				})
			]);
			const adapter = zod(schema);
			const chunks = adapter.extractChunks();
			expect(chunks).toEqual([
				{
					type: 'object',
					path: undefined,
					properties: {
						type: [{ path: 'type', type: 'literal', value: 'A' }],
						name: [{ path: 'name', type: 'string' }],
						age: [{ path: 'age', type: 'number' }],
						'someArray[]': [
							{
								path: 'someArray[]',
								type: 'string'
							}
						]
					}
				},
				{
					type: 'object',
					path: undefined,
					properties: {
						type: [{ path: 'type', type: 'literal', value: 'B' }],
						firstname: [{ path: 'firstname', type: 'string' }],
						surname: [{ path: 'surname', type: 'string' }],
						email: [{ path: 'email', type: 'string' }]
					}
				}
			]);
		});
		it('should be able to extract nested ZodUnion', () => {
			const schema = z.object({
				user: z.union([
					z.object({
						type: z.literal('A'),
						name: z.string(),
						age: z.number()
					}),
					z.object({
						type: z.literal('B'),
						firstname: z.string(),
						surname: z.string(),
						email: z.string()
					})
				])
			});
			const adapter = zod(schema);
			const chunks = adapter.extractChunks();
			expect(chunks).toEqual([
				{
					type: 'object',
					path: undefined,
					properties: {
						user: [
							{
								type: 'object',
								path: 'user',
								properties: {
									type: [{ path: 'user.type', type: 'literal', value: 'A' }],
									name: [{ path: 'user.name', type: 'string' }],
									age: [{ path: 'user.age', type: 'number' }]
								}
							},
							{
								type: 'object',
								path: 'user',
								properties: {
									type: [{ path: 'user.type', type: 'literal', value: 'B' }],
									firstname: [{ path: 'user.firstname', type: 'string' }],
									surname: [{ path: 'user.surname', type: 'string' }],
									email: [{ path: 'user.email', type: 'string' }]
								}
							}
						]
					}
				}
			]);
		});
	});
	describe('Error Handling', () => {
		it('should handle unsupported schema types', () => {
			// This tests the unsupported schema type error (line 133)
			// Create a mock schema that doesn't match any known types
			const mockSchema = {
				constructor: { name: 'UnknownZodType' },
				def: {}
			} as unknown as z.ZodType;

			expect(() => {
				const adapter = zod(mockSchema);
				adapter.extractChunks();
			}).toThrow('Unsupported schema type: UnknownZodType');
		});

		it('should handle malformed ZodPipe schemas', () => {
			// This tests the ZodPipe error handling (line 121)
			// Create a mock ZodPipe without the expected properties
			const mockZodPipe = {
				constructor: { name: 'ZodPipe' },
				def: {
					// Missing left, in, input, schema properties
					someOtherProperty: 'value'
				}
			} as unknown as z.ZodType;

			expect(() => {
				const adapter = zod(mockZodPipe);
				adapter.extractChunks();
			}).toThrow('ZodPipe input schema not found');
		});
	});
});
