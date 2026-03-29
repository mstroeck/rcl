export const TYPESCRIPT_SPECIFIC = `
TypeScript-specific checks:
- Avoid 'any' type where specific types are possible
- Check for missing null/undefined checks with strict mode
- Look for type assertions (as) that could be unsafe
- Verify proper use of generics and constraints
- Check for Promise handling in async functions
- Look for unnecessary non-null assertions (!)
- Verify enum usage vs. union types
`;
