export const RUST_SPECIFIC = `
Rust-specific checks:
- Look for unwrap()/expect() that could panic in production
- Check for unsafe blocks that could be avoided
- Verify proper error handling with Result<T, E>
- Look for unnecessary clones or allocations
- Check for proper lifetime annotations
- Verify thread safety (Send/Sync) for concurrent code
- Look for potential integer overflow
`;
