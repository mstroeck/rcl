export const PYTHON_SPECIFIC = `
Python-specific checks:
- Check for mutable default arguments (def foo(x=[]))
- Look for bare except clauses that hide errors
- Verify proper resource management (use 'with' statements)
- Check for SQL injection in string formatting/concatenation
- Look for eval() or exec() usage
- Verify proper async/await usage
- Check for common pitfalls like late binding in closures
`;
