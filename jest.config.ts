import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@config/(.*)$": "<rootDir>/src/config/$1",
    "^@modules/(.*)$": "<rootDir>/src/modules/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  },
  collectCoverageFrom: [
    "src/core/**/*.ts",
    "src/modules/**/*.service.ts",
    "src/modules/**/*.validator.ts",
    "src/modules/admin/**/*.ts",
    "!src/modules/**/__tests__/**",
    "!src/core/**/__tests__/**",
    "!src/core/**/index.ts",
    "!src/core/types/**",
    "!src/core/interfaces/**",
    // base.repository is a Mongoose adapter; covering it requires real DB integration tests.
    "!src/core/base/base.repository.ts",
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
