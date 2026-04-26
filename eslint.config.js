import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import regexp from "eslint-plugin-regexp";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

const appSourceFiles = ["apps/web/src/**/*.{ts,tsx}"];
const packageSourceFiles = ["packages/*/src/**/*.ts"];
const sourceFiles = [...appSourceFiles, ...packageSourceFiles];
const shadcnGeneratedFiles = ["apps/web/src/components/ui/**/*.{ts,tsx}"];
const typeScriptFiles = [
  ...sourceFiles,
  "apps/web/vite.config.ts",
  "scripts/**/*.ts",
  "tests/**/*.ts",
  "tests/**/*.tsx",
  "playwright.config.ts"
];

function scopeToTypeScript(configs) {
  return configs.map((config) => ({
    ...config,
    files: typeScriptFiles,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        project: [
          "./tsconfig.json",
          "./tsconfig.tools.json",
          "./apps/web/tsconfig.app.json",
          "./apps/web/tsconfig.node.json"
        ],
        tsconfigRootDir
      }
    }
  }));
}

export default tseslint.config(
  {
    ignores: [
      "Previous project/",
      "apps/web/dist/",
      "coverage/",
      "dist/",
      "node_modules/",
      "release/",
      "*.pem",
      "*.zip"
    ]
  },
  js.configs.recommended,
  ...scopeToTypeScript(tseslint.configs.strictTypeChecked),
  ...scopeToTypeScript(tseslint.configs.stylisticTypeChecked),
  regexp.configs["flat/recommended"],
  {
    plugins: {
      jsdoc,
      "no-unsanitized": noUnsanitized,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSort,
      sonarjs,
      unicorn
    },
    rules: {
      "block-scoped-var": "error",
      curly: ["error", "all"],
      "default-case-last": "error",
      "dot-notation": "error",
      "eol-last": "error",
      eqeqeq: ["error", "always"],
      "guard-for-in": "error",
      "no-alert": "error",
      "no-array-constructor": "error",
      "no-caller": "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-eval": "error",
      "no-extend-native": "error",
      "no-implicit-coercion": [
        "error",
        {
          allow: [],
          boolean: false,
          disallowTemplateShorthand: true,
          number: true,
          string: true
        }
      ],
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-new-wrappers": "error",
      "no-octal-escape": "error",
      "no-proto": "error",
      "no-restricted-globals": [
        "error",
        {
          name: "parseFloat",
          message: "Use Number() plus an explicit Number.isFinite() check."
        },
        {
          name: "parseInt",
          message: "Use Number() plus explicit validation unless parsing a non-decimal radix."
        },
        {
          name: "isFinite",
          message: "Use Number.isFinite() to avoid implicit coercion."
        },
        {
          name: "isNaN",
          message: "Use Number.isNaN() to avoid implicit coercion."
        }
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "describe",
          property: "only",
          message: "Do not commit focused test suites."
        },
        {
          object: "it",
          property: "only",
          message: "Do not commit focused tests."
        },
        {
          object: "test",
          property: "only",
          message: "Do not commit focused tests."
        }
      ],
      "no-script-url": "error",
      "no-sequences": "error",
      "no-template-curly-in-string": "error",
      "no-trailing-spaces": "error",
      "no-undef-init": "error",
      "no-unneeded-ternary": "error",
      "no-useless-call": "error",
      "no-useless-computed-key": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "one-var": ["error", "never"],
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-object-has-own": "error",
      "prefer-regex-literals": "error",
      radix: "error",
      "require-atomic-updates": "error",
      semi: ["error", "always"],

      "jsdoc/check-alignment": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-property-names": "error",
      "jsdoc/check-tag-names": "error",
      "jsdoc/check-template-names": "error",
      "jsdoc/check-types": "error",
      "jsdoc/check-values": "error",
      "jsdoc/empty-tags": "error",
      "jsdoc/implements-on-classes": "error",
      "jsdoc/no-bad-blocks": "error",
      "jsdoc/no-blank-block-descriptions": "error",
      "jsdoc/no-blank-blocks": "error",
      "jsdoc/no-defaults": "error",
      "jsdoc/no-multi-asterisks": "error",
      "jsdoc/no-types": "error",
      "jsdoc/require-description": "error",
      "jsdoc/require-hyphen-before-param-description": ["error", "never"],
      "jsdoc/require-jsdoc": [
        "error",
        {
          contexts: [
            "ExportNamedDeclaration > TSInterfaceDeclaration",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > TSEnumDeclaration",
            "ExportNamedDeclaration > VariableDeclaration"
          ],
          enableFixer: false,
          publicOnly: {
            esm: true
          },
          require: {
            ClassDeclaration: true,
            FunctionDeclaration: true,
            MethodDefinition: false
          }
        }
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-param-name": "error",
      "jsdoc/require-property": "error",
      "jsdoc/require-property-description": "error",
      "jsdoc/require-property-name": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-check": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-template": "error",
      "jsdoc/require-template-description": "error",

      "simple-import-sort/imports": "error",

      "sonarjs/cognitive-complexity": ["error", 15],
      "sonarjs/no-all-duplicated-branches": "error",
      "sonarjs/no-collapsible-if": "error",
      "sonarjs/no-duplicated-branches": "error",
      "sonarjs/no-identical-conditions": "error",
      "sonarjs/no-identical-expressions": "error",
      "sonarjs/no-inverted-boolean-check": "error",
      "sonarjs/no-nested-conditional": "error",
      "sonarjs/no-redundant-boolean": "error",
      "sonarjs/no-small-switch": "error",
      "sonarjs/no-useless-catch": "error",

      "unicorn/catch-error-name": "error",
      "unicorn/error-message": "error",
      "unicorn/no-abusive-eslint-disable": "error",
      "unicorn/no-anonymous-default-export": "error",
      "unicorn/no-new-array": "error",
      "unicorn/no-static-only-class": "error",
      "unicorn/no-useless-fallback-in-spread": "error",
      "unicorn/no-useless-spread": "error",
      "unicorn/prefer-add-event-listener": "error",
      "unicorn/prefer-dom-node-text-content": "error",
      "unicorn/prefer-modern-dom-apis": "error",
      "unicorn/prefer-number-properties": "error",
      "unicorn/prefer-string-slice": "error",
      "unicorn/throw-new-error": "error"
    }
  },
  {
    files: typeScriptFiles,
    rules: {
      "@typescript-eslint/array-type": [
        "error",
        {
          default: "array-simple",
          readonly: "array-simple"
        }
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          minimumDescriptionLength: 10,
          "ts-check": false,
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true
        }
      ],
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          disallowTypeAnnotations: true,
          fixStyle: "inline-type-imports",
          prefer: "type-imports"
        }
      ],
      "@typescript-eslint/default-param-last": "error",
      "@typescript-eslint/dot-notation": [
        "error",
        {
          allowIndexSignaturePropertyAccess: true
        }
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true
        }
      ],
      "@typescript-eslint/no-array-constructor": "error",
      "@typescript-eslint/no-array-delete": "error",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        {
          ignoreArrowShorthand: true,
          ignoreVoidOperator: false
        }
      ],
      "@typescript-eslint/no-duplicate-enum-values": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false
        }
      ],
      "@typescript-eslint/no-extraneous-class": [
        "error",
        {
          allowConstructorOnly: false,
          allowEmpty: false,
          allowStaticOnly: false,
          allowWithDecorator: false
        }
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreIIFE: false,
          ignoreVoid: false
        }
      ],
      "@typescript-eslint/no-for-in-array": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: true
        }
      ],
      "@typescript-eslint/no-misused-spread": "error",
      "@typescript-eslint/no-mixed-enums": "error",
      "@typescript-eslint/no-namespace": [
        "error",
        {
          allowDeclarations: false,
          allowDefinitionFiles: false
        }
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        {
          allowConstantLoopConditions: false
        }
      ],
      "@typescript-eslint/no-unnecessary-type-arguments": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-conversion": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-enum-comparison": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/no-wrapper-object-types": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-enum-initializers": "error",
      "@typescript-eslint/prefer-literal-enum-member": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/require-array-sort-compare": [
        "error",
        {
          ignoreStringArrays: true
        }
      ],
      "@typescript-eslint/restrict-plus-operands": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: false,
          allowRegExp: false
        }
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowAny: false,
          allowBoolean: false,
          allowNever: false,
          allowNullish: false,
          allowNumber: true,
          allowRegExp: false
        }
      ],
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowAny: false,
          allowNullableBoolean: false,
          allowNullableEnum: false,
          allowNullableNumber: false,
          allowNullableObject: true,
          allowNullableString: false,
          allowNumber: false,
          allowString: false
        }
      ],
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: false
        }
      ],
      "@typescript-eslint/triple-slash-reference": "error",
      "dot-notation": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message: "Use named exports. Default exports obscure the canonical symbol name."
        },
        {
          selector: "ExportNamedDeclaration > VariableDeclaration[kind='let']",
          message: "Do not export mutable bindings. Export an accessor function instead."
        },
        {
          selector: "TSEnumDeclaration[const=true]",
          message: "Use plain enums rather than const enums."
        }
      ]
    }
  },
  {
    files: appSourceFiles,
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true
        }
      ]
    }
  },
  {
    files: ["apps/web/vite.config.ts", "playwright.config.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
  {
    files: sourceFiles,
    ignores: ["packages/cli/src/output.ts"],
    rules: {
      "no-console": "error",
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error"
    }
  },
  {
    files: ["packages/server/src/**/*.ts", "packages/cli/src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        Bun: "readonly"
      }
    }
  },
  {
    files: [
      "apps/web/vite.config.ts",
      "scripts/**/*.ts",
      "tests/**/*.{ts,tsx}",
      "playwright.config.ts"
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        Bun: "readonly"
      },
      sourceType: "module"
    },
    rules: {
      "no-console": "off",
      "no-unsanitized/method": "off",
      "no-unsanitized/property": "off"
    }
  },
  {
    files: shadcnGeneratedFiles,
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-description": "off"
    }
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      parserOptions: {
        project: false
      },
      sourceType: "module"
    }
  }
);
