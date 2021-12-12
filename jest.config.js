module.exports = {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  coveragePathIgnorePatterns: [
    'node_modules',
    'mock.ts',
    'fixtures',
    'sample.js',
    'src/renderer.ts',
  ],
}
