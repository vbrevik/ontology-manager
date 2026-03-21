diff --git a/packages/api/app.js b/packages/api/app.js
new file mode 100644
index 0000000..b4625bc
--- /dev/null
+++ b/packages/api/app.js
@@ -0,0 +1,51 @@
+import express from 'express';
+import cors from 'cors';
+
+/**
+ * Creates a configured Express application.
+ * @param {object} [options]
+ * @param {Map} [options.graphStore] - Injectable Map for graph storage (defaults to new Map())
+ * @param {string} [options.scenarioDir] - Path to scenarios directory
+ * @returns {import('express').Express}
+ */
+export function createApp(options = {}) {
+  const app = express();
+
+  const graphStore = options.graphStore || new Map();
+  app.locals.graphStore = graphStore;
+  if (options.scenarioDir) {
+    app.locals.scenarioDir = options.scenarioDir;
+  }
+
+  // 1. CORS — restrict to Vite dev server
+  app.use(cors({ origin: 'http://localhost:5173' }));
+
+  // 2. JSON body parsing with 5mb limit (STIG V-222609)
+  app.use(express.json({ limit: '5mb' }));
+
+  // --- Routes will be mounted here by subsequent sections ---
+
+  // 3. 404 handler — unmatched routes
+  app.use((req, res, _next) => {
+    res.status(404).json({
+      type: 'about:blank',
+      title: 'Not Found',
+      status: 404,
+      detail: `${req.method} ${req.path} not found`,
+    });
+  });
+
+  // 4. Centralized error handler (placeholder — section-02 replaces this)
+  // eslint-disable-next-line no-unused-vars
+  app.use((err, req, res, _next) => {
+    const status = err.status || err.statusCode || 500;
+    res.status(status).json({
+      type: 'about:blank',
+      title: status === 500 ? 'Internal Server Error' : err.message || 'Error',
+      status,
+      detail: status === 500 ? 'An unexpected error occurred' : (err.message || 'An error occurred'),
+    });
+  });
+
+  return app;
+}
diff --git a/packages/api/package.json b/packages/api/package.json
new file mode 100644
index 0000000..4096d53
--- /dev/null
+++ b/packages/api/package.json
@@ -0,0 +1,23 @@
+{
+  "name": "@mpcg/api",
+  "version": "1.0.0",
+  "description": "REST API server wrapping @mpcg/core for the MPCG web frontend",
+  "type": "module",
+  "private": true,
+  "main": "server.js",
+  "engines": {
+    "node": ">=20"
+  },
+  "scripts": {
+    "start": "node server.js",
+    "test": "node --test tests/*.test.js"
+  },
+  "dependencies": {
+    "@mpcg/core": "workspace:*",
+    "express": "^4.21.0",
+    "cors": "^2.8.5"
+  },
+  "devDependencies": {
+    "supertest": "^7.0.0"
+  }
+}
diff --git a/packages/api/server.js b/packages/api/server.js
new file mode 100644
index 0000000..c07da0f
--- /dev/null
+++ b/packages/api/server.js
@@ -0,0 +1,8 @@
+import { createApp } from './app.js';
+
+const port = process.env.PORT || 3001;
+const app = createApp();
+
+app.listen(port, () => {
+  console.log(`MPCG API listening on http://localhost:${port}`);
+});
diff --git a/packages/api/tests/app.test.js b/packages/api/tests/app.test.js
new file mode 100644
index 0000000..2149463
--- /dev/null
+++ b/packages/api/tests/app.test.js
@@ -0,0 +1,78 @@
+import { describe, it } from 'node:test';
+import assert from 'node:assert/strict';
+import request from 'supertest';
+import { createApp } from '../app.js';
+
+describe('createApp', () => {
+  it('returns an Express app instance', () => {
+    const app = createApp();
+    assert.strictEqual(typeof app.listen, 'function');
+    assert.strictEqual(typeof app.use, 'function');
+    assert.strictEqual(typeof app.get, 'function');
+  });
+
+  it('accepts injected graphStore Map via options', () => {
+    const store = new Map();
+    const app = createApp({ graphStore: store });
+    assert.strictEqual(app.locals.graphStore, store);
+  });
+
+  it('CORS allows requests from http://localhost:5173', async () => {
+    const app = createApp();
+    const res = await request(app)
+      .options('/api/anything')
+      .set('Origin', 'http://localhost:5173')
+      .set('Access-Control-Request-Method', 'GET');
+    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
+  });
+
+  it('CORS rejects requests from other origins', async () => {
+    const app = createApp();
+    const res = await request(app)
+      .options('/api/anything')
+      .set('Origin', 'http://evil.com')
+      .set('Access-Control-Request-Method', 'GET');
+    // cors with a string origin does not reflect disallowed origins
+    assert.notStrictEqual(res.headers['access-control-allow-origin'], 'http://evil.com');
+  });
+
+  it('express.json() parses valid JSON bodies', async () => {
+    const app = createApp();
+    // POST valid JSON to a 404 route — if body parsing is configured,
+    // the request goes through without error (gets 404 from the 404 handler)
+    const res = await request(app)
+      .post('/api/nonexistent')
+      .send({ hello: 'world' })
+      .set('Content-Type', 'application/json');
+    // 404 means body parsing succeeded (didn't reject the request)
+    assert.strictEqual(res.status, 404);
+
+    // Also verify malformed JSON triggers an error (proves parser is active)
+    const malformed = await request(app)
+      .post('/api/nonexistent')
+      .send('{ bad json')
+      .set('Content-Type', 'application/json');
+    assert.strictEqual(malformed.status, 400);
+  });
+
+  it('oversized payloads (>5mb) are rejected', async () => {
+    const app = createApp();
+    const bigBody = JSON.stringify({ data: 'x'.repeat(6 * 1024 * 1024) });
+    const res = await request(app)
+      .post('/api/nonexistent')
+      .send(bigBody)
+      .set('Content-Type', 'application/json');
+    assert.ok([400, 413].includes(res.status));
+  });
+
+  it('unknown routes return 404 with RFC 7807 format', async () => {
+    const app = createApp();
+    const res = await request(app)
+      .get('/api/nonexistent');
+    assert.strictEqual(res.status, 404);
+    assert.ok(res.body.type);
+    assert.ok(res.body.title);
+    assert.strictEqual(res.body.status, 404);
+    assert.ok(res.body.detail);
+  });
+});
diff --git a/packages/api/tests/helpers/fixtures.js b/packages/api/tests/helpers/fixtures.js
new file mode 100644
index 0000000..23a4d2a
--- /dev/null
+++ b/packages/api/tests/helpers/fixtures.js
@@ -0,0 +1,97 @@
+import crypto from 'node:crypto';
+
+/**
+ * Creates a minimal valid MPCG graph input.
+ * Contains at least two nodes and one edge with valid types.
+ * @param {object} [overrides] - Properties to merge/override on the graph
+ * @returns {object} A valid graph input object with { id, nodes, edges }
+ */
+export function makeValidGraph(overrides = {}) {
+  const personId = crypto.randomUUID();
+  const eventId = crypto.randomUUID();
+  return {
+    id: crypto.randomUUID(),
+    nodes: [
+      { id: personId, type: 'Person', label: 'Alice' },
+      { id: eventId, type: 'Event', label: 'Meeting' },
+    ],
+    edges: [
+      { id: crypto.randomUUID(), source: personId, target: eventId, type: 'participates_in' },
+    ],
+    domain: 'test',
+    perspective: { agent_id: crypto.randomUUID() },
+    ...overrides,
+  };
+}
+
+/**
+ * Creates a graph input that will fail validation.
+ * Uses an invalid node type to trigger a schema error.
+ * @returns {object} An invalid graph input object
+ */
+export function makeInvalidGraph() {
+  return {
+    id: crypto.randomUUID(),
+    nodes: [
+      { id: crypto.randomUUID(), type: 'NotARealType', label: 'Bad Node' },
+    ],
+    edges: [],
+    domain: 'test',
+    perspective: { agent_id: crypto.randomUUID() },
+  };
+}
+
+/**
+ * Creates a valid graph containing contradicting belief edges.
+ * Two agents with contradictory beliefs about the same claim node.
+ * @returns {object} A valid graph with contradiction-producing edges
+ */
+export function makeGraphWithContradictions() {
+  const claim1 = crypto.randomUUID();
+  const claim2 = crypto.randomUUID();
+  const agent1 = crypto.randomUUID();
+  const agent2 = crypto.randomUUID();
+  return {
+    id: crypto.randomUUID(),
+    nodes: [
+      { id: agent1, type: 'Agent', label: 'Agent A' },
+      { id: agent2, type: 'Agent', label: 'Agent B' },
+      { id: claim1, type: 'Belief', label: 'Claim X is true' },
+      { id: claim2, type: 'Belief', label: 'Claim X is false' },
+    ],
+    edges: [
+      { id: crypto.randomUUID(), source: agent1, target: claim1, type: 'believes' },
+      { id: crypto.randomUUID(), source: agent2, target: claim2, type: 'believes' },
+      { id: crypto.randomUUID(), source: claim1, target: claim2, type: 'contradicts' },
+    ],
+    domain: 'test',
+    perspective: { agent_id: crypto.randomUUID() },
+  };
+}
+
+/**
+ * Creates a valid graph with belief edges from a specific agent.
+ * @returns {{ graph: object, agentId: string }} Graph and the agent's node ID
+ */
+export function makeGraphWithBeliefs() {
+  const agentId = crypto.randomUUID();
+  const belief1 = crypto.randomUUID();
+  const belief2 = crypto.randomUUID();
+  return {
+    graph: {
+      id: crypto.randomUUID(),
+      nodes: [
+        { id: agentId, type: 'Agent', label: 'Observer' },
+        { id: belief1, type: 'Belief', label: 'The sky is blue' },
+        { id: belief2, type: 'Belief', label: 'Water is wet' },
+      ],
+      edges: [
+        { id: crypto.randomUUID(), source: agentId, target: belief1, type: 'believes' },
+        { id: crypto.randomUUID(), source: agentId, target: belief2, type: 'believes' },
+      ],
+      domain: 'test',
+      perspective: { agent_id: crypto.randomUUID() },
+    },
+    agentId,
+  };
+}
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 3b5f4d8..20b492d 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -21,6 +21,22 @@ importers:
         specifier: ^6.0.1
         version: 6.0.1
 
+  packages/api:
+    dependencies:
+      '@mpcg/core':
+        specifier: workspace:*
+        version: link:../core
+      cors:
+        specifier: ^2.8.5
+        version: 2.8.6
+      express:
+        specifier: ^4.21.0
+        version: 4.22.1
+    devDependencies:
+      supertest:
+        specifier: ^7.0.0
+        version: 7.2.2
+
   packages/core:
     dependencies:
       ajv:
@@ -39,6 +55,13 @@ packages:
   '@anthropic-ai/sdk@0.39.0':
     resolution: {integrity: sha512-eMyDIPRZbt1CCLErRCi3exlAvNkBtRe+kW5vvJyef93PmNr/clstYgHhtvmkxN82nlKgzyGPCyGxrm0JQ1ZIdg==}
 
+  '@noble/hashes@1.8.0':
+    resolution: {integrity: sha512-jCs9ldd7NwzpgXDIf6P3+NrHh9/sD6CQdxHyjQI+h/6rDNo88ypBxxz45UDuZHz9r3tNz7N/VInSVoVdtXEI4A==}
+    engines: {node: ^14.21.3 || >=16}
+
+  '@paralleldrive/cuid2@2.3.1':
+    resolution: {integrity: sha512-XO7cAxhnTZl0Yggq6jOgjiOHhbgcO4NqFqwSmQpjK3b6TEE6Uj/jfSk6wzYyemh3+I0sHirKSetjQwn5cZktFw==}
+
   '@types/node-fetch@2.6.13':
     resolution: {integrity: sha512-QGpRVpzSaUs30JBSGPjOg4Uveu384erbHBoT1zeONvyCfwQxIkUshLAOqN/k9EjGviPRmWTTe6aH2qySWKTVSw==}
 
@@ -49,6 +72,10 @@ packages:
     resolution: {integrity: sha512-h8lQ8tacZYnR3vNQTgibj+tODHI5/+l06Au2Pcriv/Gmet0eaj4TwWH41sO9wnHDiQsEj19q0drzdWdeAHtweg==}
     engines: {node: '>=6.5'}
 
+  accepts@1.3.8:
+    resolution: {integrity: sha512-PYAthTa2m2VKxuvSD3DPC/Gy+U+sOA1LAuT8mkmRuvw+NACSaeXEQ+NHcVF7rONl6qcaxV3Uuemwawk+7+SJLw==}
+    engines: {node: '>= 0.6'}
+
   agentkeepalive@4.6.0:
     resolution: {integrity: sha512-kja8j7PjmncONqaTsB8fQ+wE2mSU2DJ9D4XKoJ5PFWIdRMa6SLSN1ff4mOr4jCbfRSsxR4keIiySJU0N9T5hIQ==}
     engines: {node: '>= 8.0.0'}
@@ -64,31 +91,113 @@ packages:
   ajv@8.18.0:
     resolution: {integrity: sha512-PlXPeEWMXMZ7sPYOHqmDyCJzcfNrUr3fGNKtezX14ykXOEIvyK81d+qydx89KY5O71FKMPaQ2vBfBFI5NHR63A==}
 
+  array-flatten@1.1.1:
+    resolution: {integrity: sha512-PCVAQswWemu6UdxsDFFX/+gVeYqKAod3D3UVm91jHwynguOwAvYPhx8nNlM++NqRcK6CxxpUafjmhIdKiHibqg==}
+
+  asap@2.0.6:
+    resolution: {integrity: sha512-BSHWgDSAiKs50o2Re8ppvp3seVHXSRM44cdSsT9FfNEUUZLOGWVCsiWaRPWM1Znn+mqZ1OfVZ3z3DWEzSp7hRA==}
+
   asynckit@0.4.0:
     resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
 
   base64-js@1.5.1:
     resolution: {integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==}
 
+  body-parser@1.20.4:
+    resolution: {integrity: sha512-ZTgYYLMOXY9qKU/57FAo8F+HA2dGX7bqGc71txDRC1rS4frdFI5R7NhluHxH6M0YItAP0sHB4uqAOcYKxO6uGA==}
+    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
+
   buffer@6.0.3:
     resolution: {integrity: sha512-FTiCpNxtwiZZHEZbcbTIcZjERVICn9yq/pDFkTl95/AxzD1naBctN7YO68riM/gLSDY7sdrMby8hofADYuuqOA==}
 
+  bytes@3.1.2:
+    resolution: {integrity: sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==}
+    engines: {node: '>= 0.8'}
+
   call-bind-apply-helpers@1.0.2:
     resolution: {integrity: sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==}
     engines: {node: '>= 0.4'}
 
+  call-bound@1.0.4:
+    resolution: {integrity: sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==}
+    engines: {node: '>= 0.4'}
+
   combined-stream@1.0.8:
     resolution: {integrity: sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==}
     engines: {node: '>= 0.8'}
 
+  component-emitter@1.3.1:
+    resolution: {integrity: sha512-T0+barUSQRTUQASh8bx02dl+DhF54GtIDY13Y3m9oWTklKbb3Wv974meRpeZ3lp1JpLVECWWNHC4vaG2XHXouQ==}
+
+  content-disposition@0.5.4:
+    resolution: {integrity: sha512-FveZTNuGw04cxlAiWbzi6zTAL/lhehaWbTtgluJh4/E95DqMwTmha3KZN1aAWA8cFIhHzMZUvLevkw5Rqk+tSQ==}
+    engines: {node: '>= 0.6'}
+
+  content-type@1.0.5:
+    resolution: {integrity: sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==}
+    engines: {node: '>= 0.6'}
+
+  cookie-signature@1.0.7:
+    resolution: {integrity: sha512-NXdYc3dLr47pBkpUCHtKSwIOQXLVn8dZEuywboCOJY/osA0wFSLlSawr3KN8qXJEyX66FcONTH8EIlVuK0yyFA==}
+
+  cookie-signature@1.2.2:
+    resolution: {integrity: sha512-D76uU73ulSXrD1UXF4KE2TMxVVwhsnCgfAyTg9k8P6KGZjlXKrOLe4dJQKI3Bxi5wjesZoFXJWElNWBjPZMbhg==}
+    engines: {node: '>=6.6.0'}
+
+  cookie@0.7.2:
+    resolution: {integrity: sha512-yki5XnKuf750l50uGTllt6kKILY4nQ1eNIQatoXEByZ5dWgnKqbnqmTrBE5B4N7lrMJKQ2ytWMiTO2o0v6Ew/w==}
+    engines: {node: '>= 0.6'}
+
+  cookiejar@2.1.4:
+    resolution: {integrity: sha512-LDx6oHrK+PhzLKJU9j5S7/Y3jM/mUHvD/DeI1WQmJn652iPC5Y4TBzC9l+5OMOXlyTTA+SmVUPm0HQUwpD5Jqw==}
+
+  cors@2.8.6:
+    resolution: {integrity: sha512-tJtZBBHA6vjIAaF6EnIaq6laBBP9aq/Y3ouVJjEfoHbRBcHBAHYcMh/w8LDrk2PvIMMq8gmopa5D4V8RmbrxGw==}
+    engines: {node: '>= 0.10'}
+
+  debug@2.6.9:
+    resolution: {integrity: sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA==}
+    peerDependencies:
+      supports-color: '*'
+    peerDependenciesMeta:
+      supports-color:
+        optional: true
+
+  debug@4.4.3:
+    resolution: {integrity: sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==}
+    engines: {node: '>=6.0'}
+    peerDependencies:
+      supports-color: '*'
+    peerDependenciesMeta:
+      supports-color:
+        optional: true
+
   delayed-stream@1.0.0:
     resolution: {integrity: sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==}
     engines: {node: '>=0.4.0'}
 
+  depd@2.0.0:
+    resolution: {integrity: sha512-g7nH6P6dyDioJogAAGprGpCtVImJhpPk/roCzdb3fIh61/s/nPsfR6onyMwkCAR/OlC3yBC0lESvUoQEAssIrw==}
+    engines: {node: '>= 0.8'}
+
+  destroy@1.2.0:
+    resolution: {integrity: sha512-2sJGJTaXIIaR1w4iJSNoN0hnMY7Gpc/n8D4qSCJw8QqFWXf7cuAgnEHxBpweaVcPevC2l3KpjYCx3NypQQgaJg==}
+    engines: {node: '>= 0.8', npm: 1.2.8000 || >= 1.4.16}
+
+  dezalgo@1.0.4:
+    resolution: {integrity: sha512-rXSP0bf+5n0Qonsb+SVVfNfIsimO4HEtmnIpPHY8Q1UCzKlQrDMfdobr8nJOOsRgWCyMRqeSBQzmWUMq7zvVig==}
+
   dunder-proto@1.0.1:
     resolution: {integrity: sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==}
     engines: {node: '>= 0.4'}
 
+  ee-first@1.1.1:
+    resolution: {integrity: sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==}
+
+  encodeurl@2.0.0:
+    resolution: {integrity: sha512-Q0n9HRi4m6JuGIV1eFlmvJB7ZEVxu93IrMyiMsGC0lrMJMWzRgx6WGquyfQgZVb31vhGgXnfmPNNXmxnOkRBrg==}
+    engines: {node: '>= 0.8'}
+
   es-define-property@1.0.1:
     resolution: {integrity: sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==}
     engines: {node: '>= 0.4'}
@@ -105,16 +214,34 @@ packages:
     resolution: {integrity: sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==}
     engines: {node: '>= 0.4'}
 
+  escape-html@1.0.3:
+    resolution: {integrity: sha512-NiSupZ4OeuGwr68lGIeym/ksIZMJodUGOSCZ/FSnTxcrekbvqrgdUxlJOMpijaKZVjAJrWrGs/6Jy8OMuyj9ow==}
+
+  etag@1.8.1:
+    resolution: {integrity: sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==}
+    engines: {node: '>= 0.6'}
+
   event-target-shim@5.0.1:
     resolution: {integrity: sha512-i/2XbnSz/uxRCU6+NdVJgKWDTM427+MqYbkQzD321DuCQJUqOuJKIA0IM2+W2xtYHdKOmZ4dR6fExsd4SXL+WQ==}
     engines: {node: '>=6'}
 
+  express@4.22.1:
+    resolution: {integrity: sha512-F2X8g9P1X7uCPZMA3MVf9wcTqlyNp7IhH5qPCI0izhaOIYXaW9L535tGA3qmjRzpH+bZczqq7hVKxTR4NWnu+g==}
+    engines: {node: '>= 0.10.0'}
+
   fast-deep-equal@3.1.3:
     resolution: {integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==}
 
+  fast-safe-stringify@2.1.1:
+    resolution: {integrity: sha512-W+KJc2dmILlPplD/H4K9l9LcAHAfPtP6BY84uVLXQ6Evcz9Lcg33Y2z1IVblT6xdY54PXYVHEv+0Wpq8Io6zkA==}
+
   fast-uri@3.1.0:
     resolution: {integrity: sha512-iPeeDKJSWf4IEOasVVrknXpaBV0IApz/gp7S2bb7Z4Lljbl2MGJRqInZiUrQwV16cpzw/D3S5j5Julj/gT52AA==}
 
+  finalhandler@1.3.2:
+    resolution: {integrity: sha512-aA4RyPcd3badbdABGDuTXCMTtOneUCAYH/gxoYRTZlIJdF0YPWuGqiAsIrhNnnqdXGswYk6dGujem4w80UJFhg==}
+    engines: {node: '>= 0.8'}
+
   form-data-encoder@1.7.2:
     resolution: {integrity: sha512-qfqtYan3rxrnCk1VYaA4H+Ms9xdpPqvLZa6xmMgFvhO32x7/3J/ExcTd6qpxM0vH2GdMI+poehyBZvqfMTto8A==}
 
@@ -126,6 +253,18 @@ packages:
     resolution: {integrity: sha512-0iirZp3uVDjVGt9p49aTaqjk84TrglENEDuqfdlZQ1roC9CWlPk6Avf8EEnZNcAqPonwkG35x4n3ww/1THYAeQ==}
     engines: {node: '>= 12.20'}
 
+  formidable@3.5.4:
+    resolution: {integrity: sha512-YikH+7CUTOtP44ZTnUhR7Ic2UASBPOqmaRkRKxRbywPTe5VxF7RRCck4af9wutiZ/QKM5nME9Bie2fFaPz5Gug==}
+    engines: {node: '>=14.0.0'}
+
+  forwarded@0.2.0:
+    resolution: {integrity: sha512-buRG0fpBtRHSTCOASe6hD258tEubFoRLb4ZNA6NxMVHNw2gOcwHo9wyablzMzOA5z9xA9L1KNjk/Nt6MT9aYow==}
+    engines: {node: '>= 0.6'}
+
+  fresh@0.5.2:
+    resolution: {integrity: sha512-zJ2mQYM18rEFOudeV4GShTGIQ7RbzA7ozbU9I/XBpm7kqgMywgmylMwXHxZJmkVoYkna9d2pVXVXPdYTP9ej8Q==}
+    engines: {node: '>= 0.6'}
+
   function-bind@1.1.2:
     resolution: {integrity: sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==}
 
@@ -153,12 +292,27 @@ packages:
     resolution: {integrity: sha512-0hJU9SCPvmMzIBdZFqNPXWa6dqh7WdH0cII9y+CyS8rG3nL48Bclra9HmKhVVUHyPWNH5Y7xDwAB7bfgSjkUMQ==}
     engines: {node: '>= 0.4'}
 
+  http-errors@2.0.1:
+    resolution: {integrity: sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==}
+    engines: {node: '>= 0.8'}
+
   humanize-ms@1.2.1:
     resolution: {integrity: sha512-Fl70vYtsAFb/C06PTS9dZBo7ihau+Tu/DNCk/OyHhea07S+aeMWpFFkUaXRa8fI+ScZbEI8dfSxwY7gxZ9SAVQ==}
 
+  iconv-lite@0.4.24:
+    resolution: {integrity: sha512-v3MXnZAcvnywkTUEZomIActle7RXXeedOR31wwl7VlyoXO4Qi9arvSenNQWne1TcRwhCL1HwLI21bEqdpj8/rA==}
+    engines: {node: '>=0.10.0'}
+
   ieee754@1.2.1:
     resolution: {integrity: sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==}
 
+  inherits@2.0.4:
+    resolution: {integrity: sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==}
+
+  ipaddr.js@1.9.1:
+    resolution: {integrity: sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==}
+    engines: {node: '>= 0.10'}
+
   json-schema-traverse@1.0.0:
     resolution: {integrity: sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==}
 
@@ -166,6 +320,17 @@ packages:
     resolution: {integrity: sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==}
     engines: {node: '>= 0.4'}
 
+  media-typer@0.3.0:
+    resolution: {integrity: sha512-dq+qelQ9akHpcOl/gUVRTxVIOkAJ1wR3QAvb4RsVjS8oVoFjDGTc679wJYmUmknUF5HwMLOgb5O+a3KxfWapPQ==}
+    engines: {node: '>= 0.6'}
+
+  merge-descriptors@1.0.3:
+    resolution: {integrity: sha512-gaNvAS7TZ897/rVaZ0nMtAyxNyi/pdbjbAwUpFQpN70GqnVfOiXpeUUMKRBmzXaSQ8DdTX4/0ms62r2K+hE6mQ==}
+
+  methods@1.1.2:
+    resolution: {integrity: sha512-iclAHeNqNm68zFtnZ0e+1L2yUIdvzNoauKU4WBA3VvH/vPFieF7qfRlwUZU+DA9P9bPXIS90ulxoUoCH23sV2w==}
+    engines: {node: '>= 0.6'}
+
   mime-db@1.52.0:
     resolution: {integrity: sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==}
     engines: {node: '>= 0.6'}
@@ -174,9 +339,26 @@ packages:
     resolution: {integrity: sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==}
     engines: {node: '>= 0.6'}
 
+  mime@1.6.0:
+    resolution: {integrity: sha512-x0Vn8spI+wuJ1O6S7gnbaQg8Pxh4NNHb7KSINmEWKiPE4RKOplvijn+NkmYmmRgP68mc70j2EbeTFRsrswaQeg==}
+    engines: {node: '>=4'}
+    hasBin: true
+
+  mime@2.6.0:
+    resolution: {integrity: sha512-USPkMeET31rOMiarsBNIHZKLGgvKc/LrjofAnBlOttf5ajRvqiRA8QsenbcooctK6d6Ts6aqZXBA+XbkKthiQg==}
+    engines: {node: '>=4.0.0'}
+    hasBin: true
+
+  ms@2.0.0:
+    resolution: {integrity: sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==}
+
   ms@2.1.3:
     resolution: {integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==}
 
+  negotiator@0.6.3:
+    resolution: {integrity: sha512-+EUsqGPLsM+j/zdChZjsnX51g4XrHFOIXwfnCVPGlQk/k5giakcKsuxCObBRu6DSm9opw/O6slWbJdghQM4bBg==}
+    engines: {node: '>= 0.6'}
+
   neo4j-driver-bolt-connection@6.0.1:
     resolution: {integrity: sha512-1KyG73TO+CwnYJisdHD0sjUw9yR+P5q3JFcmVPzsHT4/whzCjuXSMpmY4jZcHH2PdY2cBUq4l/6WcDiPMxW2UA==}
 
@@ -201,6 +383,48 @@ packages:
       encoding:
         optional: true
 
+  object-assign@4.1.1:
+    resolution: {integrity: sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==}
+    engines: {node: '>=0.10.0'}
+
+  object-inspect@1.13.4:
+    resolution: {integrity: sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==}
+    engines: {node: '>= 0.4'}
+
+  on-finished@2.4.1:
+    resolution: {integrity: sha512-oVlzkg3ENAhCk2zdv7IJwd/QUD4z2RxRwpkcGY8psCVcCYZNq4wYnVWALHM+brtuJjePWiYF/ClmuDr8Ch5+kg==}
+    engines: {node: '>= 0.8'}
+
+  once@1.4.0:
+    resolution: {integrity: sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==}
+
+  parseurl@1.3.3:
+    resolution: {integrity: sha512-CiyeOxFT/JZyN5m0z9PfXw4SCBJ6Sygz1Dpl0wqjlhDEGGBP1GnsUVEL0p63hoG1fcj3fHynXi9NYO4nWOL+qQ==}
+    engines: {node: '>= 0.8'}
+
+  path-to-regexp@0.1.12:
+    resolution: {integrity: sha512-RA1GjUVMnvYFxuqovrEqZoxxW5NUZqbwKtYz/Tt7nXerk0LbLblQmrsgdeOxV5SFHf0UDggjS/bSeOZwt1pmEQ==}
+
+  proxy-addr@2.0.7:
+    resolution: {integrity: sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==}
+    engines: {node: '>= 0.10'}
+
+  qs@6.14.2:
+    resolution: {integrity: sha512-V/yCWTTF7VJ9hIh18Ugr2zhJMP01MY7c5kh4J870L7imm6/DIzBsNLTXzMwUA3yZ5b/KBqLx8Kp3uRvd7xSe3Q==}
+    engines: {node: '>=0.6'}
+
+  qs@6.15.0:
+    resolution: {integrity: sha512-mAZTtNCeetKMH+pSjrb76NAM8V9a05I9aBZOHztWy/UqcJdQYNsf59vrRKWnojAT9Y+GbIvoTBC++CPHqpDBhQ==}
+    engines: {node: '>=0.6'}
+
+  range-parser@1.2.1:
+    resolution: {integrity: sha512-Hrgsx+orqoygnmhFbKaHE6c296J+HTAQXoxEF6gNupROmmGJRoyzfG3ccAveqCBrwr/2yxQ5BVd/GTl5agOwSg==}
+    engines: {node: '>= 0.6'}
+
+  raw-body@2.5.3:
+    resolution: {integrity: sha512-s4VSOf6yN0rvbRZGxs8Om5CWj6seneMwK3oDb4lWDH0UPhWcxwOWw5+qk24bxq87szX1ydrwylIOp2uG1ojUpA==}
+    engines: {node: '>= 0.8'}
+
   require-from-string@2.0.2:
     resolution: {integrity: sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==}
     engines: {node: '>=0.10.0'}
@@ -211,15 +435,65 @@ packages:
   safe-buffer@5.2.1:
     resolution: {integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==}
 
+  safer-buffer@2.1.2:
+    resolution: {integrity: sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==}
+
+  send@0.19.2:
+    resolution: {integrity: sha512-VMbMxbDeehAxpOtWJXlcUS5E8iXh6QmN+BkRX1GARS3wRaXEEgzCcB10gTQazO42tpNIya8xIyNx8fll1OFPrg==}
+    engines: {node: '>= 0.8.0'}
+
+  serve-static@1.16.3:
+    resolution: {integrity: sha512-x0RTqQel6g5SY7Lg6ZreMmsOzncHFU7nhnRWkKgWuMTu5NN0DR5oruckMqRvacAN9d5w6ARnRBXl9xhDCgfMeA==}
+    engines: {node: '>= 0.8.0'}
+
+  setprototypeof@1.2.0:
+    resolution: {integrity: sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==}
+
+  side-channel-list@1.0.0:
+    resolution: {integrity: sha512-FCLHtRD/gnpCiCHEiJLOwdmFP+wzCmDEkc9y7NsYxeF4u7Btsn1ZuwgwJGxImImHicJArLP4R0yX4c2KCrMrTA==}
+    engines: {node: '>= 0.4'}
+
+  side-channel-map@1.0.1:
+    resolution: {integrity: sha512-VCjCNfgMsby3tTdo02nbjtM/ewra6jPHmpThenkTYh8pG9ucZ/1P8So4u4FGBek/BjpOVsDCMoLA/iuBKIFXRA==}
+    engines: {node: '>= 0.4'}
+
+  side-channel-weakmap@1.0.2:
+    resolution: {integrity: sha512-WPS/HvHQTYnHisLo9McqBHOJk2FkHO/tlpvldyrnem4aeQp4hai3gythswg6p01oSoTl58rcpiFAjF2br2Ak2A==}
+    engines: {node: '>= 0.4'}
+
+  side-channel@1.1.0:
+    resolution: {integrity: sha512-ZX99e6tRweoUXqR+VBrslhda51Nh5MTQwou5tnUDgbtyM0dBgmhEDtWGP/xbKn6hqfPRHujUNwz5fy/wbbhnpw==}
+    engines: {node: '>= 0.4'}
+
+  statuses@2.0.2:
+    resolution: {integrity: sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==}
+    engines: {node: '>= 0.8'}
+
   string_decoder@1.3.0:
     resolution: {integrity: sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==}
 
+  superagent@10.3.0:
+    resolution: {integrity: sha512-B+4Ik7ROgVKrQsXTV0Jwp2u+PXYLSlqtDAhYnkkD+zn3yg8s/zjA2MeGayPoY/KICrbitwneDHrjSotxKL+0XQ==}
+    engines: {node: '>=14.18.0'}
+
+  supertest@7.2.2:
+    resolution: {integrity: sha512-oK8WG9diS3DlhdUkcFn4tkNIiIbBx9lI2ClF8K+b2/m8Eyv47LSawxUzZQSNKUrVb2KsqeTDCcjAAVPYaSLVTA==}
+    engines: {node: '>=14.18.0'}
+
+  toidentifier@1.0.1:
+    resolution: {integrity: sha512-o5sSPKEkg/DIQNmH43V0/uerLrpzVedkUh8tGNvaeXpfpuwjKenlSox/2O/BTlZUtEe+JG7s5YhEz608PlAHRA==}
+    engines: {node: '>=0.6'}
+
   tr46@0.0.3:
     resolution: {integrity: sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==}
 
   tslib@2.8.1:
     resolution: {integrity: sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==}
 
+  type-is@1.6.18:
+    resolution: {integrity: sha512-TkRKr9sUTxEH8MdfuCSP7VizJyzRNMjj2J2do2Jr3Kym598JVdEksuzPQCnlFPW4ky9Q+iA+ma9BGm06XQBy8g==}
+    engines: {node: '>= 0.6'}
+
   typescript@5.9.3:
     resolution: {integrity: sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==}
     engines: {node: '>=14.17'}
@@ -228,6 +502,18 @@ packages:
   undici-types@5.26.5:
     resolution: {integrity: sha512-JlCMO+ehdEIKqlFxk6IfVoAUVmgz7cU7zD/h9XZ0qzeosSHmUJVOzSQvvYSYWXkFXC+IfLKSIffhv0sVZup6pA==}
 
+  unpipe@1.0.0:
+    resolution: {integrity: sha512-pjy2bYhSsufwWlKwPc+l3cN7+wuJlK6uz0YdJEOlQDbl6jo/YlPi4mb8agUkVC8BF7V8NuzeyPNqRksA3hztKQ==}
+    engines: {node: '>= 0.8'}
+
+  utils-merge@1.0.1:
+    resolution: {integrity: sha512-pMZTvIkT1d+TFGvDOqodOclx0QWkkgi6Tdoa8gC8ffGAAqz9pzPTZWAybbsHHoED/ztMtkv/VoYTYyShUn81hA==}
+    engines: {node: '>= 0.4.0'}
+
+  vary@1.1.2:
+    resolution: {integrity: sha512-BNGbWLfd0eUPabhkXUVm0j8uuvREyTh5ovRa/dyow/BqAbZJyC+5fU+IzQOzmAKzYqYRAISoRhdQr3eIZ/PXqg==}
+    engines: {node: '>= 0.8'}
+
   web-streams-polyfill@4.0.0-beta.3:
     resolution: {integrity: sha512-QW95TCTaHmsYfHDybGMwO5IJIM93I/6vTRk+daHTWFPhwh+C8Cg7j7XyKrwrj8Ib6vYXe0ocYNrmzY4xAAN6ug==}
     engines: {node: '>= 14'}
@@ -238,6 +524,9 @@ packages:
   whatwg-url@5.0.0:
     resolution: {integrity: sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==}
 
+  wrappy@1.0.2:
+    resolution: {integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==}
+
 snapshots:
 
   '@anthropic-ai/sdk@0.39.0':
@@ -252,6 +541,12 @@ snapshots:
     transitivePeerDependencies:
       - encoding
 
+  '@noble/hashes@1.8.0': {}
+
+  '@paralleldrive/cuid2@2.3.1':
+    dependencies:
+      '@noble/hashes': 1.8.0
+
   '@types/node-fetch@2.6.13':
     dependencies:
       '@types/node': 18.19.130
@@ -265,6 +560,11 @@ snapshots:
     dependencies:
       event-target-shim: 5.0.1
 
+  accepts@1.3.8:
+    dependencies:
+      mime-types: 2.1.35
+      negotiator: 0.6.3
+
   agentkeepalive@4.6.0:
     dependencies:
       humanize-ms: 1.2.1
@@ -280,32 +580,102 @@ snapshots:
       json-schema-traverse: 1.0.0
       require-from-string: 2.0.2
 
+  array-flatten@1.1.1: {}
+
+  asap@2.0.6: {}
+
   asynckit@0.4.0: {}
 
   base64-js@1.5.1: {}
 
+  body-parser@1.20.4:
+    dependencies:
+      bytes: 3.1.2
+      content-type: 1.0.5
+      debug: 2.6.9
+      depd: 2.0.0
+      destroy: 1.2.0
+      http-errors: 2.0.1
+      iconv-lite: 0.4.24
+      on-finished: 2.4.1
+      qs: 6.14.2
+      raw-body: 2.5.3
+      type-is: 1.6.18
+      unpipe: 1.0.0
+    transitivePeerDependencies:
+      - supports-color
+
   buffer@6.0.3:
     dependencies:
       base64-js: 1.5.1
       ieee754: 1.2.1
 
+  bytes@3.1.2: {}
+
   call-bind-apply-helpers@1.0.2:
     dependencies:
       es-errors: 1.3.0
       function-bind: 1.1.2
 
+  call-bound@1.0.4:
+    dependencies:
+      call-bind-apply-helpers: 1.0.2
+      get-intrinsic: 1.3.0
+
   combined-stream@1.0.8:
     dependencies:
       delayed-stream: 1.0.0
 
+  component-emitter@1.3.1: {}
+
+  content-disposition@0.5.4:
+    dependencies:
+      safe-buffer: 5.2.1
+
+  content-type@1.0.5: {}
+
+  cookie-signature@1.0.7: {}
+
+  cookie-signature@1.2.2: {}
+
+  cookie@0.7.2: {}
+
+  cookiejar@2.1.4: {}
+
+  cors@2.8.6:
+    dependencies:
+      object-assign: 4.1.1
+      vary: 1.1.2
+
+  debug@2.6.9:
+    dependencies:
+      ms: 2.0.0
+
+  debug@4.4.3:
+    dependencies:
+      ms: 2.1.3
+
   delayed-stream@1.0.0: {}
 
+  depd@2.0.0: {}
+
+  destroy@1.2.0: {}
+
+  dezalgo@1.0.4:
+    dependencies:
+      asap: 2.0.6
+      wrappy: 1.0.2
+
   dunder-proto@1.0.1:
     dependencies:
       call-bind-apply-helpers: 1.0.2
       es-errors: 1.3.0
       gopd: 1.2.0
 
+  ee-first@1.1.1: {}
+
+  encodeurl@2.0.0: {}
+
   es-define-property@1.0.1: {}
 
   es-errors@1.3.0: {}
@@ -321,12 +691,66 @@ snapshots:
       has-tostringtag: 1.0.2
       hasown: 2.0.2
 
+  escape-html@1.0.3: {}
+
+  etag@1.8.1: {}
+
   event-target-shim@5.0.1: {}
 
+  express@4.22.1:
+    dependencies:
+      accepts: 1.3.8
+      array-flatten: 1.1.1
+      body-parser: 1.20.4
+      content-disposition: 0.5.4
+      content-type: 1.0.5
+      cookie: 0.7.2
+      cookie-signature: 1.0.7
+      debug: 2.6.9
+      depd: 2.0.0
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      etag: 1.8.1
+      finalhandler: 1.3.2
+      fresh: 0.5.2
+      http-errors: 2.0.1
+      merge-descriptors: 1.0.3
+      methods: 1.1.2
+      on-finished: 2.4.1
+      parseurl: 1.3.3
+      path-to-regexp: 0.1.12
+      proxy-addr: 2.0.7
+      qs: 6.14.2
+      range-parser: 1.2.1
+      safe-buffer: 5.2.1
+      send: 0.19.2
+      serve-static: 1.16.3
+      setprototypeof: 1.2.0
+      statuses: 2.0.2
+      type-is: 1.6.18
+      utils-merge: 1.0.1
+      vary: 1.1.2
+    transitivePeerDependencies:
+      - supports-color
+
   fast-deep-equal@3.1.3: {}
 
+  fast-safe-stringify@2.1.1: {}
+
   fast-uri@3.1.0: {}
 
+  finalhandler@1.3.2:
+    dependencies:
+      debug: 2.6.9
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      on-finished: 2.4.1
+      parseurl: 1.3.3
+      statuses: 2.0.2
+      unpipe: 1.0.0
+    transitivePeerDependencies:
+      - supports-color
+
   form-data-encoder@1.7.2: {}
 
   form-data@4.0.5:
@@ -342,6 +766,16 @@ snapshots:
       node-domexception: 1.0.0
       web-streams-polyfill: 4.0.0-beta.3
 
+  formidable@3.5.4:
+    dependencies:
+      '@paralleldrive/cuid2': 2.3.1
+      dezalgo: 1.0.4
+      once: 1.4.0
+
+  forwarded@0.2.0: {}
+
+  fresh@0.5.2: {}
+
   function-bind@1.1.2: {}
 
   get-intrinsic@1.3.0:
@@ -374,24 +808,54 @@ snapshots:
     dependencies:
       function-bind: 1.1.2
 
+  http-errors@2.0.1:
+    dependencies:
+      depd: 2.0.0
+      inherits: 2.0.4
+      setprototypeof: 1.2.0
+      statuses: 2.0.2
+      toidentifier: 1.0.1
+
   humanize-ms@1.2.1:
     dependencies:
       ms: 2.1.3
 
+  iconv-lite@0.4.24:
+    dependencies:
+      safer-buffer: 2.1.2
+
   ieee754@1.2.1: {}
 
+  inherits@2.0.4: {}
+
+  ipaddr.js@1.9.1: {}
+
   json-schema-traverse@1.0.0: {}
 
   math-intrinsics@1.1.0: {}
 
+  media-typer@0.3.0: {}
+
+  merge-descriptors@1.0.3: {}
+
+  methods@1.1.2: {}
+
   mime-db@1.52.0: {}
 
   mime-types@2.1.35:
     dependencies:
       mime-db: 1.52.0
 
+  mime@1.6.0: {}
+
+  mime@2.6.0: {}
+
+  ms@2.0.0: {}
+
   ms@2.1.3: {}
 
+  negotiator@0.6.3: {}
+
   neo4j-driver-bolt-connection@6.0.1:
     dependencies:
       buffer: 6.0.3
@@ -412,6 +876,44 @@ snapshots:
     dependencies:
       whatwg-url: 5.0.0
 
+  object-assign@4.1.1: {}
+
+  object-inspect@1.13.4: {}
+
+  on-finished@2.4.1:
+    dependencies:
+      ee-first: 1.1.1
+
+  once@1.4.0:
+    dependencies:
+      wrappy: 1.0.2
+
+  parseurl@1.3.3: {}
+
+  path-to-regexp@0.1.12: {}
+
+  proxy-addr@2.0.7:
+    dependencies:
+      forwarded: 0.2.0
+      ipaddr.js: 1.9.1
+
+  qs@6.14.2:
+    dependencies:
+      side-channel: 1.1.0
+
+  qs@6.15.0:
+    dependencies:
+      side-channel: 1.1.0
+
+  range-parser@1.2.1: {}
+
+  raw-body@2.5.3:
+    dependencies:
+      bytes: 3.1.2
+      http-errors: 2.0.1
+      iconv-lite: 0.4.24
+      unpipe: 1.0.0
+
   require-from-string@2.0.2: {}
 
   rxjs@7.8.2:
@@ -420,18 +922,114 @@ snapshots:
 
   safe-buffer@5.2.1: {}
 
+  safer-buffer@2.1.2: {}
+
+  send@0.19.2:
+    dependencies:
+      debug: 2.6.9
+      depd: 2.0.0
+      destroy: 1.2.0
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      etag: 1.8.1
+      fresh: 0.5.2
+      http-errors: 2.0.1
+      mime: 1.6.0
+      ms: 2.1.3
+      on-finished: 2.4.1
+      range-parser: 1.2.1
+      statuses: 2.0.2
+    transitivePeerDependencies:
+      - supports-color
+
+  serve-static@1.16.3:
+    dependencies:
+      encodeurl: 2.0.0
+      escape-html: 1.0.3
+      parseurl: 1.3.3
+      send: 0.19.2
+    transitivePeerDependencies:
+      - supports-color
+
+  setprototypeof@1.2.0: {}
+
+  side-channel-list@1.0.0:
+    dependencies:
+      es-errors: 1.3.0
+      object-inspect: 1.13.4
+
+  side-channel-map@1.0.1:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+      object-inspect: 1.13.4
+
+  side-channel-weakmap@1.0.2:
+    dependencies:
+      call-bound: 1.0.4
+      es-errors: 1.3.0
+      get-intrinsic: 1.3.0
+      object-inspect: 1.13.4
+      side-channel-map: 1.0.1
+
+  side-channel@1.1.0:
+    dependencies:
+      es-errors: 1.3.0
+      object-inspect: 1.13.4
+      side-channel-list: 1.0.0
+      side-channel-map: 1.0.1
+      side-channel-weakmap: 1.0.2
+
+  statuses@2.0.2: {}
+
   string_decoder@1.3.0:
     dependencies:
       safe-buffer: 5.2.1
 
+  superagent@10.3.0:
+    dependencies:
+      component-emitter: 1.3.1
+      cookiejar: 2.1.4
+      debug: 4.4.3
+      fast-safe-stringify: 2.1.1
+      form-data: 4.0.5
+      formidable: 3.5.4
+      methods: 1.1.2
+      mime: 2.6.0
+      qs: 6.15.0
+    transitivePeerDependencies:
+      - supports-color
+
+  supertest@7.2.2:
+    dependencies:
+      cookie-signature: 1.2.2
+      methods: 1.1.2
+      superagent: 10.3.0
+    transitivePeerDependencies:
+      - supports-color
+
+  toidentifier@1.0.1: {}
+
   tr46@0.0.3: {}
 
   tslib@2.8.1: {}
 
+  type-is@1.6.18:
+    dependencies:
+      media-typer: 0.3.0
+      mime-types: 2.1.35
+
   typescript@5.9.3: {}
 
   undici-types@5.26.5: {}
 
+  unpipe@1.0.0: {}
+
+  utils-merge@1.0.1: {}
+
+  vary@1.1.2: {}
+
   web-streams-polyfill@4.0.0-beta.3: {}
 
   webidl-conversions@3.0.1: {}
@@ -440,3 +1038,5 @@ snapshots:
     dependencies:
       tr46: 0.0.3
       webidl-conversions: 3.0.1
+
+  wrappy@1.0.2: {}
