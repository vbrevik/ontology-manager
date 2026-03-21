diff --git a/package-lock.json b/package-lock.json
deleted file mode 100644
index e55dc69..0000000
--- a/package-lock.json
+++ /dev/null
@@ -1,647 +0,0 @@
-{
-  "name": "universal-context-model",
-  "version": "0.1.0",
-  "lockfileVersion": 3,
-  "requires": true,
-  "packages": {
-    "": {
-      "name": "universal-context-model",
-      "version": "0.1.0",
-      "dependencies": {
-        "@anthropic-ai/sdk": "^0.39.0",
-        "ajv": "^8.17.1",
-        "ajv-formats": "^3.0.1",
-        "neo4j-driver": "^6.0.1"
-      }
-    },
-    "node_modules/@anthropic-ai/sdk": {
-      "version": "0.39.0",
-      "resolved": "https://registry.npmjs.org/@anthropic-ai/sdk/-/sdk-0.39.0.tgz",
-      "integrity": "sha512-eMyDIPRZbt1CCLErRCi3exlAvNkBtRe+kW5vvJyef93PmNr/clstYgHhtvmkxN82nlKgzyGPCyGxrm0JQ1ZIdg==",
-      "license": "MIT",
-      "dependencies": {
-        "@types/node": "^18.11.18",
-        "@types/node-fetch": "^2.6.4",
-        "abort-controller": "^3.0.0",
-        "agentkeepalive": "^4.2.1",
-        "form-data-encoder": "1.7.2",
-        "formdata-node": "^4.3.2",
-        "node-fetch": "^2.6.7"
-      }
-    },
-    "node_modules/@types/node": {
-      "version": "18.19.130",
-      "resolved": "https://registry.npmjs.org/@types/node/-/node-18.19.130.tgz",
-      "integrity": "sha512-GRaXQx6jGfL8sKfaIDD6OupbIHBr9jv7Jnaml9tB7l4v068PAOXqfcujMMo5PhbIs6ggR1XODELqahT2R8v0fg==",
-      "license": "MIT",
-      "dependencies": {
-        "undici-types": "~5.26.4"
-      }
-    },
-    "node_modules/@types/node-fetch": {
-      "version": "2.6.13",
-      "resolved": "https://registry.npmjs.org/@types/node-fetch/-/node-fetch-2.6.13.tgz",
-      "integrity": "sha512-QGpRVpzSaUs30JBSGPjOg4Uveu384erbHBoT1zeONvyCfwQxIkUshLAOqN/k9EjGviPRmWTTe6aH2qySWKTVSw==",
-      "license": "MIT",
-      "dependencies": {
-        "@types/node": "*",
-        "form-data": "^4.0.4"
-      }
-    },
-    "node_modules/abort-controller": {
-      "version": "3.0.0",
-      "resolved": "https://registry.npmjs.org/abort-controller/-/abort-controller-3.0.0.tgz",
-      "integrity": "sha512-h8lQ8tacZYnR3vNQTgibj+tODHI5/+l06Au2Pcriv/Gmet0eaj4TwWH41sO9wnHDiQsEj19q0drzdWdeAHtweg==",
-      "license": "MIT",
-      "dependencies": {
-        "event-target-shim": "^5.0.0"
-      },
-      "engines": {
-        "node": ">=6.5"
-      }
-    },
-    "node_modules/agentkeepalive": {
-      "version": "4.6.0",
-      "resolved": "https://registry.npmjs.org/agentkeepalive/-/agentkeepalive-4.6.0.tgz",
-      "integrity": "sha512-kja8j7PjmncONqaTsB8fQ+wE2mSU2DJ9D4XKoJ5PFWIdRMa6SLSN1ff4mOr4jCbfRSsxR4keIiySJU0N9T5hIQ==",
-      "license": "MIT",
-      "dependencies": {
-        "humanize-ms": "^1.2.1"
-      },
-      "engines": {
-        "node": ">= 8.0.0"
-      }
-    },
-    "node_modules/ajv": {
-      "version": "8.18.0",
-      "resolved": "https://registry.npmjs.org/ajv/-/ajv-8.18.0.tgz",
-      "integrity": "sha512-PlXPeEWMXMZ7sPYOHqmDyCJzcfNrUr3fGNKtezX14ykXOEIvyK81d+qydx89KY5O71FKMPaQ2vBfBFI5NHR63A==",
-      "license": "MIT",
-      "dependencies": {
-        "fast-deep-equal": "^3.1.3",
-        "fast-uri": "^3.0.1",
-        "json-schema-traverse": "^1.0.0",
-        "require-from-string": "^2.0.2"
-      },
-      "funding": {
-        "type": "github",
-        "url": "https://github.com/sponsors/epoberezkin"
-      }
-    },
-    "node_modules/ajv-formats": {
-      "version": "3.0.1",
-      "resolved": "https://registry.npmjs.org/ajv-formats/-/ajv-formats-3.0.1.tgz",
-      "integrity": "sha512-8iUql50EUR+uUcdRQ3HDqa6EVyo3docL8g5WJ3FNcWmu62IbkGUue/pEyLBW8VGKKucTPgqeks4fIU1DA4yowQ==",
-      "license": "MIT",
-      "dependencies": {
-        "ajv": "^8.0.0"
-      },
-      "peerDependencies": {
-        "ajv": "^8.0.0"
-      },
-      "peerDependenciesMeta": {
-        "ajv": {
-          "optional": true
-        }
-      }
-    },
-    "node_modules/asynckit": {
-      "version": "0.4.0",
-      "resolved": "https://registry.npmjs.org/asynckit/-/asynckit-0.4.0.tgz",
-      "integrity": "sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==",
-      "license": "MIT"
-    },
-    "node_modules/base64-js": {
-      "version": "1.5.1",
-      "resolved": "https://registry.npmjs.org/base64-js/-/base64-js-1.5.1.tgz",
-      "integrity": "sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==",
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/feross"
-        },
-        {
-          "type": "patreon",
-          "url": "https://www.patreon.com/feross"
-        },
-        {
-          "type": "consulting",
-          "url": "https://feross.org/support"
-        }
-      ],
-      "license": "MIT"
-    },
-    "node_modules/buffer": {
-      "version": "6.0.3",
-      "resolved": "https://registry.npmjs.org/buffer/-/buffer-6.0.3.tgz",
-      "integrity": "sha512-FTiCpNxtwiZZHEZbcbTIcZjERVICn9yq/pDFkTl95/AxzD1naBctN7YO68riM/gLSDY7sdrMby8hofADYuuqOA==",
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/feross"
-        },
-        {
-          "type": "patreon",
-          "url": "https://www.patreon.com/feross"
-        },
-        {
-          "type": "consulting",
-          "url": "https://feross.org/support"
-        }
-      ],
-      "license": "MIT",
-      "dependencies": {
-        "base64-js": "^1.3.1",
-        "ieee754": "^1.2.1"
-      }
-    },
-    "node_modules/call-bind-apply-helpers": {
-      "version": "1.0.2",
-      "resolved": "https://registry.npmjs.org/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz",
-      "integrity": "sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==",
-      "license": "MIT",
-      "dependencies": {
-        "es-errors": "^1.3.0",
-        "function-bind": "^1.1.2"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/combined-stream": {
-      "version": "1.0.8",
-      "resolved": "https://registry.npmjs.org/combined-stream/-/combined-stream-1.0.8.tgz",
-      "integrity": "sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==",
-      "license": "MIT",
-      "dependencies": {
-        "delayed-stream": "~1.0.0"
-      },
-      "engines": {
-        "node": ">= 0.8"
-      }
-    },
-    "node_modules/delayed-stream": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/delayed-stream/-/delayed-stream-1.0.0.tgz",
-      "integrity": "sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==",
-      "license": "MIT",
-      "engines": {
-        "node": ">=0.4.0"
-      }
-    },
-    "node_modules/dunder-proto": {
-      "version": "1.0.1",
-      "resolved": "https://registry.npmjs.org/dunder-proto/-/dunder-proto-1.0.1.tgz",
-      "integrity": "sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==",
-      "license": "MIT",
-      "dependencies": {
-        "call-bind-apply-helpers": "^1.0.1",
-        "es-errors": "^1.3.0",
-        "gopd": "^1.2.0"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/es-define-property": {
-      "version": "1.0.1",
-      "resolved": "https://registry.npmjs.org/es-define-property/-/es-define-property-1.0.1.tgz",
-      "integrity": "sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/es-errors": {
-      "version": "1.3.0",
-      "resolved": "https://registry.npmjs.org/es-errors/-/es-errors-1.3.0.tgz",
-      "integrity": "sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/es-object-atoms": {
-      "version": "1.1.1",
-      "resolved": "https://registry.npmjs.org/es-object-atoms/-/es-object-atoms-1.1.1.tgz",
-      "integrity": "sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==",
-      "license": "MIT",
-      "dependencies": {
-        "es-errors": "^1.3.0"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/es-set-tostringtag": {
-      "version": "2.1.0",
-      "resolved": "https://registry.npmjs.org/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz",
-      "integrity": "sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==",
-      "license": "MIT",
-      "dependencies": {
-        "es-errors": "^1.3.0",
-        "get-intrinsic": "^1.2.6",
-        "has-tostringtag": "^1.0.2",
-        "hasown": "^2.0.2"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/event-target-shim": {
-      "version": "5.0.1",
-      "resolved": "https://registry.npmjs.org/event-target-shim/-/event-target-shim-5.0.1.tgz",
-      "integrity": "sha512-i/2XbnSz/uxRCU6+NdVJgKWDTM427+MqYbkQzD321DuCQJUqOuJKIA0IM2+W2xtYHdKOmZ4dR6fExsd4SXL+WQ==",
-      "license": "MIT",
-      "engines": {
-        "node": ">=6"
-      }
-    },
-    "node_modules/fast-deep-equal": {
-      "version": "3.1.3",
-      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
-      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
-      "license": "MIT"
-    },
-    "node_modules/fast-uri": {
-      "version": "3.1.0",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.0.tgz",
-      "integrity": "sha512-iPeeDKJSWf4IEOasVVrknXpaBV0IApz/gp7S2bb7Z4Lljbl2MGJRqInZiUrQwV16cpzw/D3S5j5Julj/gT52AA==",
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/fastify"
-        },
-        {
-          "type": "opencollective",
-          "url": "https://opencollective.com/fastify"
-        }
-      ],
-      "license": "BSD-3-Clause"
-    },
-    "node_modules/form-data": {
-      "version": "4.0.5",
-      "resolved": "https://registry.npmjs.org/form-data/-/form-data-4.0.5.tgz",
-      "integrity": "sha512-8RipRLol37bNs2bhoV67fiTEvdTrbMUYcFTiy3+wuuOnUog2QBHCZWXDRijWQfAkhBj2Uf5UnVaiWwA5vdd82w==",
-      "license": "MIT",
-      "dependencies": {
-        "asynckit": "^0.4.0",
-        "combined-stream": "^1.0.8",
-        "es-set-tostringtag": "^2.1.0",
-        "hasown": "^2.0.2",
-        "mime-types": "^2.1.12"
-      },
-      "engines": {
-        "node": ">= 6"
-      }
-    },
-    "node_modules/form-data-encoder": {
-      "version": "1.7.2",
-      "resolved": "https://registry.npmjs.org/form-data-encoder/-/form-data-encoder-1.7.2.tgz",
-      "integrity": "sha512-qfqtYan3rxrnCk1VYaA4H+Ms9xdpPqvLZa6xmMgFvhO32x7/3J/ExcTd6qpxM0vH2GdMI+poehyBZvqfMTto8A==",
-      "license": "MIT"
-    },
-    "node_modules/formdata-node": {
-      "version": "4.4.1",
-      "resolved": "https://registry.npmjs.org/formdata-node/-/formdata-node-4.4.1.tgz",
-      "integrity": "sha512-0iirZp3uVDjVGt9p49aTaqjk84TrglENEDuqfdlZQ1roC9CWlPk6Avf8EEnZNcAqPonwkG35x4n3ww/1THYAeQ==",
-      "license": "MIT",
-      "dependencies": {
-        "node-domexception": "1.0.0",
-        "web-streams-polyfill": "4.0.0-beta.3"
-      },
-      "engines": {
-        "node": ">= 12.20"
-      }
-    },
-    "node_modules/function-bind": {
-      "version": "1.1.2",
-      "resolved": "https://registry.npmjs.org/function-bind/-/function-bind-1.1.2.tgz",
-      "integrity": "sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==",
-      "license": "MIT",
-      "funding": {
-        "url": "https://github.com/sponsors/ljharb"
-      }
-    },
-    "node_modules/get-intrinsic": {
-      "version": "1.3.0",
-      "resolved": "https://registry.npmjs.org/get-intrinsic/-/get-intrinsic-1.3.0.tgz",
-      "integrity": "sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==",
-      "license": "MIT",
-      "dependencies": {
-        "call-bind-apply-helpers": "^1.0.2",
-        "es-define-property": "^1.0.1",
-        "es-errors": "^1.3.0",
-        "es-object-atoms": "^1.1.1",
-        "function-bind": "^1.1.2",
-        "get-proto": "^1.0.1",
-        "gopd": "^1.2.0",
-        "has-symbols": "^1.1.0",
-        "hasown": "^2.0.2",
-        "math-intrinsics": "^1.1.0"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      },
-      "funding": {
-        "url": "https://github.com/sponsors/ljharb"
-      }
-    },
-    "node_modules/get-proto": {
-      "version": "1.0.1",
-      "resolved": "https://registry.npmjs.org/get-proto/-/get-proto-1.0.1.tgz",
-      "integrity": "sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g==",
-      "license": "MIT",
-      "dependencies": {
-        "dunder-proto": "^1.0.1",
-        "es-object-atoms": "^1.0.0"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/gopd": {
-      "version": "1.2.0",
-      "resolved": "https://registry.npmjs.org/gopd/-/gopd-1.2.0.tgz",
-      "integrity": "sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 0.4"
-      },
-      "funding": {
-        "url": "https://github.com/sponsors/ljharb"
-      }
-    },
-    "node_modules/has-symbols": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/has-symbols/-/has-symbols-1.1.0.tgz",
-      "integrity": "sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 0.4"
-      },
-      "funding": {
-        "url": "https://github.com/sponsors/ljharb"
-      }
-    },
-    "node_modules/has-tostringtag": {
-      "version": "1.0.2",
-      "resolved": "https://registry.npmjs.org/has-tostringtag/-/has-tostringtag-1.0.2.tgz",
-      "integrity": "sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==",
-      "license": "MIT",
-      "dependencies": {
-        "has-symbols": "^1.0.3"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      },
-      "funding": {
-        "url": "https://github.com/sponsors/ljharb"
-      }
-    },
-    "node_modules/hasown": {
-      "version": "2.0.2",
-      "resolved": "https://registry.npmjs.org/hasown/-/hasown-2.0.2.tgz",
-      "integrity": "sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==",
-      "license": "MIT",
-      "dependencies": {
-        "function-bind": "^1.1.2"
-      },
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/humanize-ms": {
-      "version": "1.2.1",
-      "resolved": "https://registry.npmjs.org/humanize-ms/-/humanize-ms-1.2.1.tgz",
-      "integrity": "sha512-Fl70vYtsAFb/C06PTS9dZBo7ihau+Tu/DNCk/OyHhea07S+aeMWpFFkUaXRa8fI+ScZbEI8dfSxwY7gxZ9SAVQ==",
-      "license": "MIT",
-      "dependencies": {
-        "ms": "^2.0.0"
-      }
-    },
-    "node_modules/ieee754": {
-      "version": "1.2.1",
-      "resolved": "https://registry.npmjs.org/ieee754/-/ieee754-1.2.1.tgz",
-      "integrity": "sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==",
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/feross"
-        },
-        {
-          "type": "patreon",
-          "url": "https://www.patreon.com/feross"
-        },
-        {
-          "type": "consulting",
-          "url": "https://feross.org/support"
-        }
-      ],
-      "license": "BSD-3-Clause"
-    },
-    "node_modules/json-schema-traverse": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-1.0.0.tgz",
-      "integrity": "sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==",
-      "license": "MIT"
-    },
-    "node_modules/math-intrinsics": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/math-intrinsics/-/math-intrinsics-1.1.0.tgz",
-      "integrity": "sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 0.4"
-      }
-    },
-    "node_modules/mime-db": {
-      "version": "1.52.0",
-      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
-      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 0.6"
-      }
-    },
-    "node_modules/mime-types": {
-      "version": "2.1.35",
-      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
-      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
-      "license": "MIT",
-      "dependencies": {
-        "mime-db": "1.52.0"
-      },
-      "engines": {
-        "node": ">= 0.6"
-      }
-    },
-    "node_modules/ms": {
-      "version": "2.1.3",
-      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
-      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
-      "license": "MIT"
-    },
-    "node_modules/neo4j-driver": {
-      "version": "6.0.1",
-      "resolved": "https://registry.npmjs.org/neo4j-driver/-/neo4j-driver-6.0.1.tgz",
-      "integrity": "sha512-8DDF2MwEJNz7y7cp97x4u8fmVIP4CWS8qNBxdwxTG0fWtsS+2NdeC+7uXwmmuFOpHvkfXqv63uWY73bfDtOH8Q==",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "neo4j-driver-bolt-connection": "6.0.1",
-        "neo4j-driver-core": "6.0.1",
-        "rxjs": "^7.8.2"
-      },
-      "engines": {
-        "node": ">=18.0.0"
-      }
-    },
-    "node_modules/neo4j-driver-bolt-connection": {
-      "version": "6.0.1",
-      "resolved": "https://registry.npmjs.org/neo4j-driver-bolt-connection/-/neo4j-driver-bolt-connection-6.0.1.tgz",
-      "integrity": "sha512-1KyG73TO+CwnYJisdHD0sjUw9yR+P5q3JFcmVPzsHT4/whzCjuXSMpmY4jZcHH2PdY2cBUq4l/6WcDiPMxW2UA==",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "buffer": "^6.0.3",
-        "neo4j-driver-core": "6.0.1",
-        "string_decoder": "^1.3.0"
-      }
-    },
-    "node_modules/neo4j-driver-core": {
-      "version": "6.0.1",
-      "resolved": "https://registry.npmjs.org/neo4j-driver-core/-/neo4j-driver-core-6.0.1.tgz",
-      "integrity": "sha512-5I2KxICAvcHxnWdJyDqwu8PBAQvWVTlQH2ve3VQmtVdJScPqWhpXN1PiX5IIl+cRF3pFpz9GQF53B5n6s0QQUQ==",
-      "license": "Apache-2.0"
-    },
-    "node_modules/node-domexception": {
-      "version": "1.0.0",
-      "resolved": "https://registry.npmjs.org/node-domexception/-/node-domexception-1.0.0.tgz",
-      "integrity": "sha512-/jKZoMpw0F8GRwl4/eLROPA3cfcXtLApP0QzLmUT/HuPCZWyB7IY9ZrMeKw2O/nFIqPQB3PVM9aYm0F312AXDQ==",
-      "deprecated": "Use your platform's native DOMException instead",
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/jimmywarting"
-        },
-        {
-          "type": "github",
-          "url": "https://paypal.me/jimmywarting"
-        }
-      ],
-      "license": "MIT",
-      "engines": {
-        "node": ">=10.5.0"
-      }
-    },
-    "node_modules/node-fetch": {
-      "version": "2.7.0",
-      "resolved": "https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz",
-      "integrity": "sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==",
-      "license": "MIT",
-      "dependencies": {
-        "whatwg-url": "^5.0.0"
-      },
-      "engines": {
-        "node": "4.x || >=6.0.0"
-      },
-      "peerDependencies": {
-        "encoding": "^0.1.0"
-      },
-      "peerDependenciesMeta": {
-        "encoding": {
-          "optional": true
-        }
-      }
-    },
-    "node_modules/require-from-string": {
-      "version": "2.0.2",
-      "resolved": "https://registry.npmjs.org/require-from-string/-/require-from-string-2.0.2.tgz",
-      "integrity": "sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==",
-      "license": "MIT",
-      "engines": {
-        "node": ">=0.10.0"
-      }
-    },
-    "node_modules/rxjs": {
-      "version": "7.8.2",
-      "resolved": "https://registry.npmjs.org/rxjs/-/rxjs-7.8.2.tgz",
-      "integrity": "sha512-dhKf903U/PQZY6boNNtAGdWbG85WAbjT/1xYoZIC7FAY0yWapOBQVsVrDl58W86//e1VpMNBtRV4MaXfdMySFA==",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "tslib": "^2.1.0"
-      }
-    },
-    "node_modules/safe-buffer": {
-      "version": "5.2.1",
-      "resolved": "https://registry.npmjs.org/safe-buffer/-/safe-buffer-5.2.1.tgz",
-      "integrity": "sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==",
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/feross"
-        },
-        {
-          "type": "patreon",
-          "url": "https://www.patreon.com/feross"
-        },
-        {
-          "type": "consulting",
-          "url": "https://feross.org/support"
-        }
-      ],
-      "license": "MIT"
-    },
-    "node_modules/string_decoder": {
-      "version": "1.3.0",
-      "resolved": "https://registry.npmjs.org/string_decoder/-/string_decoder-1.3.0.tgz",
-      "integrity": "sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==",
-      "license": "MIT",
-      "dependencies": {
-        "safe-buffer": "~5.2.0"
-      }
-    },
-    "node_modules/tr46": {
-      "version": "0.0.3",
-      "resolved": "https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz",
-      "integrity": "sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==",
-      "license": "MIT"
-    },
-    "node_modules/tslib": {
-      "version": "2.8.1",
-      "resolved": "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz",
-      "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
-      "license": "0BSD"
-    },
-    "node_modules/undici-types": {
-      "version": "5.26.5",
-      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-5.26.5.tgz",
-      "integrity": "sha512-JlCMO+ehdEIKqlFxk6IfVoAUVmgz7cU7zD/h9XZ0qzeosSHmUJVOzSQvvYSYWXkFXC+IfLKSIffhv0sVZup6pA==",
-      "license": "MIT"
-    },
-    "node_modules/web-streams-polyfill": {
-      "version": "4.0.0-beta.3",
-      "resolved": "https://registry.npmjs.org/web-streams-polyfill/-/web-streams-polyfill-4.0.0-beta.3.tgz",
-      "integrity": "sha512-QW95TCTaHmsYfHDybGMwO5IJIM93I/6vTRk+daHTWFPhwh+C8Cg7j7XyKrwrj8Ib6vYXe0ocYNrmzY4xAAN6ug==",
-      "license": "MIT",
-      "engines": {
-        "node": ">= 14"
-      }
-    },
-    "node_modules/webidl-conversions": {
-      "version": "3.0.1",
-      "resolved": "https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz",
-      "integrity": "sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==",
-      "license": "BSD-2-Clause"
-    },
-    "node_modules/whatwg-url": {
-      "version": "5.0.0",
-      "resolved": "https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz",
-      "integrity": "sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==",
-      "license": "MIT",
-      "dependencies": {
-        "tr46": "~0.0.3",
-        "webidl-conversions": "^3.0.0"
-      }
-    }
-  }
-}
diff --git a/package.json b/package.json
index 72c268b..0c2a14b 100644
--- a/package.json
+++ b/package.json
@@ -3,6 +3,7 @@
   "version": "0.1.0",
   "description": "A data model describing context as universally as possible, evolved via autoresearch",
   "type": "module",
+  "private": true,
   "scripts": {
     "evaluate": "node src/evaluate.js",
     "generate-owl": "node src/generate-owl.js",
diff --git a/packages/core/.gitignore b/packages/core/.gitignore
new file mode 100644
index 0000000..fb955fb
--- /dev/null
+++ b/packages/core/.gitignore
@@ -0,0 +1,7 @@
+# Build artifacts - copied from src/
+schema.json
+taxonomy.json
+graph-engine.js
+
+# Generated TypeScript declarations
+types/
diff --git a/packages/core/package.json b/packages/core/package.json
new file mode 100644
index 0000000..6f64d54
--- /dev/null
+++ b/packages/core/package.json
@@ -0,0 +1,38 @@
+{
+  "name": "@mpcg/core",
+  "version": "1.0.0",
+  "description": "MPCG (Multi-Perspective Context Graph) core library — schema, validation, and graph engine",
+  "type": "module",
+  "private": true,
+  "engines": {
+    "node": ">=20"
+  },
+  "exports": {
+    ".": {
+      "types": "./types/index.d.ts",
+      "default": "./index.js"
+    }
+  },
+  "files": [
+    "index.js",
+    "validate.js",
+    "graph-engine.js",
+    "schema.json",
+    "taxonomy.json",
+    "types/"
+  ],
+  "scripts": {
+    "clean": "rm -rf types/ schema.json taxonomy.json graph-engine.js",
+    "prebuild": "npm run clean",
+    "build": "node scripts/build.js && tsc",
+    "test": "node --test tests/*.test.js",
+    "test:types": "tsc --noEmit --project tsconfig.test.json"
+  },
+  "dependencies": {
+    "ajv": "^8.17.1",
+    "ajv-formats": "^3.0.1"
+  },
+  "devDependencies": {
+    "typescript": "^5.4.0"
+  }
+}
diff --git a/packages/core/tests/workspace-setup.test.js b/packages/core/tests/workspace-setup.test.js
new file mode 100644
index 0000000..348074a
--- /dev/null
+++ b/packages/core/tests/workspace-setup.test.js
@@ -0,0 +1,79 @@
+import { describe, it } from 'node:test';
+import assert from 'node:assert/strict';
+import { readFileSync, existsSync } from 'node:fs';
+import { join } from 'node:path';
+
+const ROOT = join(import.meta.dirname, '..', '..', '..');
+
+describe('pnpm workspace foundation', () => {
+  it('pnpm-workspace.yaml exists at project root', () => {
+    assert.ok(existsSync(join(ROOT, 'pnpm-workspace.yaml')));
+  });
+
+  it('pnpm-workspace.yaml contains packages/* glob', () => {
+    const content = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf-8');
+    assert.ok(content.includes('packages/*'), 'should contain packages/* glob');
+  });
+
+  it('root package.json has "private": true', () => {
+    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
+    assert.strictEqual(pkg.private, true);
+  });
+
+  it('root package.json retains existing dependencies', () => {
+    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
+    assert.ok(pkg.dependencies.ajv, 'should retain ajv');
+    assert.ok(pkg.dependencies['ajv-formats'], 'should retain ajv-formats');
+  });
+
+  it('root package.json retains existing scripts', () => {
+    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
+    assert.ok(pkg.scripts.test, 'should retain test script');
+  });
+
+  it('packages/core/package.json exists with name @mpcg/core', () => {
+    const corePkg = JSON.parse(
+      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
+    );
+    assert.strictEqual(corePkg.name, '@mpcg/core');
+  });
+
+  it('packages/core/package.json has "type": "module"', () => {
+    const corePkg = JSON.parse(
+      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
+    );
+    assert.strictEqual(corePkg.type, 'module');
+  });
+
+  it('packages/core/package.json has engines >= 20', () => {
+    const corePkg = JSON.parse(
+      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
+    );
+    assert.strictEqual(corePkg.engines.node, '>=20');
+  });
+
+  it('packages/core/package.json has ajv and ajv-formats as dependencies', () => {
+    const corePkg = JSON.parse(
+      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
+    );
+    assert.ok(corePkg.dependencies.ajv);
+    assert.ok(corePkg.dependencies['ajv-formats']);
+  });
+
+  it('packages/core/package.json has "private": true', () => {
+    const corePkg = JSON.parse(
+      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf-8')
+    );
+    assert.strictEqual(corePkg.private, true);
+  });
+
+  it('pnpm install succeeds and @mpcg/core is linked', () => {
+    // pnpm uses a virtual store — check both direct and virtual store paths
+    const directPath = join(ROOT, 'node_modules', '@mpcg', 'core');
+    const virtualPath = join(ROOT, 'node_modules', '.pnpm', 'node_modules', '@mpcg', 'core');
+    assert.ok(
+      existsSync(directPath) || existsSync(virtualPath),
+      '@mpcg/core should be linked in node_modules (direct or virtual store)'
+    );
+  });
+});
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
new file mode 100644
index 0000000..3b5f4d8
--- /dev/null
+++ b/pnpm-lock.yaml
@@ -0,0 +1,442 @@
+lockfileVersion: '9.0'
+
+settings:
+  autoInstallPeers: true
+  excludeLinksFromLockfile: false
+
+importers:
+
+  .:
+    dependencies:
+      '@anthropic-ai/sdk':
+        specifier: ^0.39.0
+        version: 0.39.0
+      ajv:
+        specifier: ^8.17.1
+        version: 8.18.0
+      ajv-formats:
+        specifier: ^3.0.1
+        version: 3.0.1(ajv@8.18.0)
+      neo4j-driver:
+        specifier: ^6.0.1
+        version: 6.0.1
+
+  packages/core:
+    dependencies:
+      ajv:
+        specifier: ^8.17.1
+        version: 8.18.0
+      ajv-formats:
+        specifier: ^3.0.1
+        version: 3.0.1(ajv@8.18.0)
+    devDependencies:
+      typescript:
+        specifier: ^5.4.0
+        version: 5.9.3
+
+packages:
+
+  '@anthropic-ai/sdk@0.39.0':
+    resolution: {integrity: sha512-eMyDIPRZbt1CCLErRCi3exlAvNkBtRe+kW5vvJyef93PmNr/clstYgHhtvmkxN82nlKgzyGPCyGxrm0JQ1ZIdg==}
+
+  '@types/node-fetch@2.6.13':
+    resolution: {integrity: sha512-QGpRVpzSaUs30JBSGPjOg4Uveu384erbHBoT1zeONvyCfwQxIkUshLAOqN/k9EjGviPRmWTTe6aH2qySWKTVSw==}
+
+  '@types/node@18.19.130':
+    resolution: {integrity: sha512-GRaXQx6jGfL8sKfaIDD6OupbIHBr9jv7Jnaml9tB7l4v068PAOXqfcujMMo5PhbIs6ggR1XODELqahT2R8v0fg==}
+
+  abort-controller@3.0.0:
+    resolution: {integrity: sha512-h8lQ8tacZYnR3vNQTgibj+tODHI5/+l06Au2Pcriv/Gmet0eaj4TwWH41sO9wnHDiQsEj19q0drzdWdeAHtweg==}
+    engines: {node: '>=6.5'}
+
+  agentkeepalive@4.6.0:
+    resolution: {integrity: sha512-kja8j7PjmncONqaTsB8fQ+wE2mSU2DJ9D4XKoJ5PFWIdRMa6SLSN1ff4mOr4jCbfRSsxR4keIiySJU0N9T5hIQ==}
+    engines: {node: '>= 8.0.0'}
+
+  ajv-formats@3.0.1:
+    resolution: {integrity: sha512-8iUql50EUR+uUcdRQ3HDqa6EVyo3docL8g5WJ3FNcWmu62IbkGUue/pEyLBW8VGKKucTPgqeks4fIU1DA4yowQ==}
+    peerDependencies:
+      ajv: ^8.0.0
+    peerDependenciesMeta:
+      ajv:
+        optional: true
+
+  ajv@8.18.0:
+    resolution: {integrity: sha512-PlXPeEWMXMZ7sPYOHqmDyCJzcfNrUr3fGNKtezX14ykXOEIvyK81d+qydx89KY5O71FKMPaQ2vBfBFI5NHR63A==}
+
+  asynckit@0.4.0:
+    resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
+
+  base64-js@1.5.1:
+    resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}
+
+  buffer@6.0.3:
+    resolution: {integrity: sha512-FTiCpNxtwiZZHEZbcbTIcZjERVICn9yq/pDFkTl95/AxzD1naBctN7YO68riM/gLSDY7sdrMby8hofADYuuqOA==}
+
+  call-bind-apply-helpers@1.0.2:
+    resolution: {integrity: sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==}
+    engines: {node: '>= 0.4'}
+
+  combined-stream@1.0.8:
+    resolution: {integrity: sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==}
+    engines: {node: '>= 0.8'}
+
+  delayed-stream@1.0.0:
+    resolution: {integrity: sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==}
+    engines: {node: '>=0.4.0'}
+
+  dunder-proto@1.0.1:
+    resolution: {integrity: sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==}
+    engines: {node: '>= 0.4'}
+
+  es-define-property@1.0.1:
+    resolution: {integrity: sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==}
+    engines: {node: '>= 0.4'}
+
+  es-errors@1.3.0:
+    resolution: {integrity: sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==}
+    engines: {node: '>= 0.4'}
+
+  es-object-atoms@1.1.1:
+    resolution: {integrity: sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==}
+    engines: {node: '>= 0.4'}
+
+  es-set-tostringtag@2.1.0:
+    resolution: {integrity: sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==}
+    engines: {node: '>= 0.4'}
+
+  event-target-shim@5.0.1:
+    resolution: {integrity: sha512-i/2XbnSz/uxRCU6+NdVJgKWDTM427+MqYbkQzD321DuCQJUqOuJKIA0IM2+W2xtYHdKOmZ4dR6fExsd4SXL+WQ==}
+    engines: {node: '>=6'}
+
+  fast-deep-equal@3.1.3:
+    resolution: {integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==}
+
+  fast-uri@3.1.0:
+    resolution: {integrity: sha512-iPeeDKJSWf4IEOasVVrknXpaBV0IApz/gp7S2bb7Z4Lljbl2MGJRqInZiUrQwV16cpzw/D3S5j5Julj/gT52AA==}
+
+  form-data-encoder@1.7.2:
+    resolution: {integrity: sha512-qfqtYan3rxrnCk1VYaA4H+Ms9xdpPqvLZa6xmMgFvhO32x7/3J/ExcTd6qpxM0vH2GdMI+poehyBZvqfMTto8A==}
+
+  form-data@4.0.5:
+    resolution: {integrity: sha512-8RipRLol37bNs2bhoV67fiTEvdTrbMUYcFTiy3+wuuOnUog2QBHCZWXDRijWQfAkhBj2Uf5UnVaiWwA5vdd82w==}
+    engines: {node: '>= 6'}
+
+  formdata-node@4.4.1:
+    resolution: {integrity: sha512-0iirZp3uVDjVGt9p49aTaqjk84TrglENEDuqfdlZQ1roC9CWlPk6Avf8EEnZNcAqPonwkG35x4n3ww/1THYAeQ==}
+    engines: {node: '>= 12.20'}
+
+  function-bind@1.1.2:
+    resolution: {integrity: sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==}
+
+  get-intrinsic@1.3.0:
+    resolution: {integrity: sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==}
+    engines: {node: '>= 0.4'}
+
+  get-proto@1.0.1:
+    resolution: {integrity: sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g==}
+    engines: {node: '>= 0.4'}
+
+  gopd@1.2.0:
+    resolution: {integrity: sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==}
+    engines: {node: '>= 0.4'}
+
+  has-symbols@1.1.0:
+    resolution: {integrity: sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ==}
+    engines: {node: '>= 0.4'}
+
+  has-tostringtag@1.0.2:
+    resolution: {integrity: sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==}
+    engines: {node: '>= 0.4'}
+
+  hasown@2.0.2:
+    resolution: {integrity: sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==}
+    engines: {node: '>= 0.4'}
+
+  humanize-ms@1.2.1:
+    resolution: {integrity: sha512-Fl70vYtsAFb/C06PTS9dZBo7ihau+Tu/DNCk/OyHhea07S+aeMWpFFkUaXRa8fI+ScZbEI8dfSxwY7gxZ9SAVQ==}
+
+  ieee754@1.2.1:
+    resolution: {integrity: sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==}
+
+  json-schema-traverse@1.0.0:
+    resolution: {integrity: sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==}
+
+  math-intrinsics@1.1.0:
+    resolution: {integrity: sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==}
+    engines: {node: '>= 0.4'}
+
+  mime-db@1.52.0:
+    resolution: {integrity: sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==}
+    engines: {node: '>= 0.6'}
+
+  mime-types@2.1.35:
+    resolution: {integrity: sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==}
+    engines: {node: '>= 0.6'}
+
+  ms@2.1.3:
+    resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}
+
+  neo4j-driver-bolt-connection@6.0.1:
+    resolution: {integrity: sha512-1KyG73TO+CwnYJisdHD0sjUw9yR+P5q3JFcmVPzsHT4/whzCjuXSMpmY4jZcHH2PdY2cBUq4l/6WcDiPMxW2UA==}
+
+  neo4j-driver-core@6.0.1:
+    resolution: {integrity: sha512-5I2KxICAvcHxnWdJyDqwu8PBAQvWVTlQH2ve3VQmtVdJScPqWhpXN1PiX5IIl+cRF3pFpz9GQF53B5n6s0QQUQ==}
+
+  neo4j-driver@6.0.1:
+    resolution: {integrity: sha512-8DDF2MwEJNz7y7cp97x4u8fmVIP4CWS8qNBxdwxTG0fWtsS+2NdeC+7uXwmmuFOpHvkfXqv63uWY73bfDtOH8Q==}
+    engines: {node: '>=18.0.0'}
+
+  node-domexception@1.0.0:
+    resolution: {integrity: sha512-/jKZoMpw0F8GRwl4/eLROPA3cfcXtLApP0QzLmUT/HuPCZWyB7IY9ZrMeKw2O/nFIqPQB3PVM9aYm0F312AXDQ==}
+    engines: {node: '>=10.5.0'}
+    deprecated: Use your platform's native DOMException instead
+
+  node-fetch@2.7.0:
+    resolution: {integrity: sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==}
+    engines: {node: 4.x || >=6.0.0}
+    peerDependencies:
+      encoding: ^0.1.0
+    peerDependenciesMeta:
+      encoding:
+        optional: true
+
+  require-from-string@2.0.2:
+    resolution: {integrity: sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==}
+    engines: {node: '>=0.10.0'}
+
+  rxjs@7.8.2:
+    resolution: {integrity: sha512-dhKf903U/PQZY6boNNtAGdWbG85WAbjT/1xYoZIC7FAY0yWapOBQVsVrDl58W86//e1VpMNBtRV4MaXfdMySFA==}
+
+  safe-buffer@5.2.1:
+    resolution: {integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==}
+
+  string_decoder@1.3.0:
+    resolution: {integrity: sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==}
+
+  tr46@0.0.3:
+    resolution: {integrity: sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==}
+
+  tslib@2.8.1:
+    resolution: {integrity: sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==}
+
+  typescript@5.9.3:
+    resolution: {integrity: sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==}
+    engines: {node: '>=14.17'}
+    hasBin: true
+
+  undici-types@5.26.5:
+    resolution: {integrity: sha512-JlCMO+ehdEIKqlFxk6IfVoAUVmgz7cU7zD/h9XZ0qzeosSHmUJVOzSQvvYSYWXkFXC+IfLKSIffhv0sVZup6pA==}
+
+  web-streams-polyfill@4.0.0-beta.3:
+    resolution: {integrity: sha512-QW95TCTaHmsYfHDybGMwO5IJIM93I/6vTRk+daHTWFPhwh+C8Cg7j7XyKrwrj8Ib6vYXe0ocYNrmzY4xAAN6ug==}
+    engines: {node: '>= 14'}
+
+  webidl-conversions@3.0.1:
+    resolution: {integrity: sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==}
+
+  whatwg-url@5.0.0:
+    resolution: {integrity: sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==}
+
+snapshots:
+
+  '@anthropic-ai/sdk@0.39.0':
+    dependencies:
+      '@types/node': 18.19.130
+      '@types/node-fetch': 2.6.13
+      abort-controller: 3.0.0
+      agentkeepalive: 4.6.0
+      form-data-encoder: 1.7.2
+      formdata-node: 4.4.1
+      node-fetch: 2.7.0
+    transitivePeerDependencies:
+      - encoding
+
+  '@types/node-fetch@2.6.13':
+    dependencies:
+      '@types/node': 18.19.130
+      form-data: 4.0.5
+
+  '@types/node@18.19.130':
+    dependencies:
+      undici-types: 5.26.5
+
+  abort-controller@3.0.0:
+    dependencies:
+      event-target-shim: 5.0.1
+
+  agentkeepalive@4.6.0:
+    dependencies:
+      humanize-ms: 1.2.1
+
+  ajv-formats@3.0.1(ajv@8.18.0):
+    optionalDependencies:
+      ajv: 8.18.0
+
+  ajv@8.18.0:
+    dependencies:
+      fast-deep-equal: 3.1.3
+      fast-uri: 3.1.0
+      json-schema-traverse: 1.0.0
+      require-from-string: 2.0.2
+
+  asynckit@0.4.0: {}
+
+  base64-js@1.5.1: {}
+
+  buffer@6.0.3:
+    dependencies:
+      base64-js: 1.5.1
+      ieee754: 1.2.1
+
+  call-bind-apply-helpers@1.0.2:
+    dependencies:
+      es-errors: 1.3.0
+      function-bind: 1.1.2
+
+  combined-stream@1.0.8:
+    dependencies:
+      delayed-stream: 1.0.0
+
+  delayed-stream@1.0.0: {}
+
+  dunder-proto@1.0.1:
+    dependencies:
+      call-bind-apply-helpers: 1.0.2
+      es-errors: 1.3.0
+      gopd: 1.2.0
+
+  es-define-property@1.0.1: {}
+
+  es-errors@1.3.0: {}
+
+  es-object-atoms@1.1.1:
+    dependencies:
+      es-errors: 1.3.0
+
+  es-set-tostringtag@2.1.0:
+    dependencies:
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+      has-tostringtag: 1.0.2
+      hasown: 2.0.2
+
+  event-target-shim@5.0.1: {}
+
+  fast-deep-equal@3.1.3: {}
+
+  fast-uri@3.1.0: {}
+
+  form-data-encoder@1.7.2: {}
+
+  form-data@4.0.5:
+    dependencies:
+      asynckit: 0.4.0
+      combined-stream: 1.0.8
+      es-set-tostringtag: 2.1.0
+      hasown: 2.0.2
+      mime-types: 2.1.35
+
+  formdata-node@4.4.1:
+    dependencies:
+      node-domexception: 1.0.0
+      web-streams-polyfill: 4.0.0-beta.3
+
+  function-bind@1.1.2: {}
+
+  get-intrinsic@1.3.0:
+    dependencies:
+      call-bind-apply-helpers: 1.0.2
+      es-define-property: 1.0.1
+      es-errors: 1.3.0
+      es-object-atoms: 1.1.1
+      function-bind: 1.1.2
+      get-proto: 1.0.1
+      gopd: 1.2.0
+      has-symbols: 1.1.0
+      hasown: 2.0.2
+      math-intrinsics: 1.1.0
+
+  get-proto@1.0.1:
+    dependencies:
+      dunder-proto: 1.0.1
+      es-object-atoms: 1.1.1
+
+  gopd@1.2.0: {}
+
+  has-symbols@1.1.0: {}
+
+  has-tostringtag@1.0.2:
+    dependencies:
+      has-symbols: 1.1.0
+
+  hasown@2.0.2:
+    dependencies:
+      function-bind: 1.1.2
+
+  humanize-ms@1.2.1:
+    dependencies:
+      ms: 2.1.3
+
+  ieee754@1.2.1: {}
+
+  json-schema-traverse@1.0.0: {}
+
+  math-intrinsics@1.1.0: {}
+
+  mime-db@1.52.0: {}
+
+  mime-types@2.1.35:
+    dependencies:
+      mime-db: 1.52.0
+
+  ms@2.1.3: {}
+
+  neo4j-driver-bolt-connection@6.0.1:
+    dependencies:
+      buffer: 6.0.3
+      neo4j-driver-core: 6.0.1
+      string_decoder: 1.3.0
+
+  neo4j-driver-core@6.0.1: {}
+
+  neo4j-driver@6.0.1:
+    dependencies:
+      neo4j-driver-bolt-connection: 6.0.1
+      neo4j-driver-core: 6.0.1
+      rxjs: 7.8.2
+
+  node-domexception@1.0.0: {}
+
+  node-fetch@2.7.0:
+    dependencies:
+      whatwg-url: 5.0.0
+
+  require-from-string@2.0.2: {}
+
+  rxjs@7.8.2:
+    dependencies:
+      tslib: 2.8.1
+
+  safe-buffer@5.2.1: {}
+
+  string_decoder@1.3.0:
+    dependencies:
+      safe-buffer: 5.2.1
+
+  tr46@0.0.3: {}
+
+  tslib@2.8.1: {}
+
+  typescript@5.9.3: {}
+
+  undici-types@5.26.5: {}
+
+  web-streams-polyfill@4.0.0-beta.3: {}
+
+  webidl-conversions@3.0.1: {}
+
+  whatwg-url@5.0.0:
+    dependencies:
+      tr46: 0.0.3
+      webidl-conversions: 3.0.1
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
new file mode 100644
index 0000000..18ec407
--- /dev/null
+++ b/pnpm-workspace.yaml
@@ -0,0 +1,2 @@
+packages:
+  - 'packages/*'
