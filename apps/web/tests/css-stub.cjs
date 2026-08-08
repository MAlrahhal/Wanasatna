// Test-only require hook: stubs .css imports so plugin modules load under Node.
require.extensions['.css'] = () => {};
