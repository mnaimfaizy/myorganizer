export * from './generated/tokens';

// Only the primitive tier is exported. `generated/roles.css` is a stylesheet, not a
// module — the web application imports it from its own stylesheet, and nothing should
// reach it through this index.
//
// Nothing CommonJS belongs here either. This index is reachable from browser bundles,
// and a `module.exports = {...}` re-export dragged into one of them is what broke the
// Email Shell Storybook chunk in Chromatic with `Cannot set properties of undefined
// (setting 'exports')`. If a build config ever needs a CommonJS artifact from this
// library, import the generated file by path.
