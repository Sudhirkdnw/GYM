module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.(t|j)s", "!**/*.module.ts", "!main.ts"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@gymos/shared-types$": "<rootDir>/../../packages/shared-types/src",
    "^@gymos/validation$": "<rootDir>/../../packages/validation/src",
    "^@gymos/config$": "<rootDir>/../../packages/config/src",
  },
};
