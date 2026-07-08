import { InMemoryIdentityRuntime } from "../../packages/identity-runtime/src/index.js";

function assertEqual(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const identity = new InMemoryIdentityRuntime();

identity.registerUser({
  userId: "user-1",
  organizationId: "org-1",
  roles: ["admin"],
  locale: "fr",
});

identity.registerWorkspace({
  id: "org-1",
  name: "Opays",
  plugins: ["commerce"],
});

const tests = [
  {
    name: "IdentityRuntime authenticates anonymous requests",
    run: async () => {
      const result = await identity.authenticate({
        channel: "web",
        rawPayload: {},
        text: "hello",
      });
      assertEqual(result.userId, "anonymous");
    },
  },
  {
    name: "IdentityRuntime authenticates registered users",
    run: async () => {
      const result = await identity.authenticate({
        channel: "api",
        rawPayload: {},
        headers: { authorization: "Bearer user-1" },
      });
      assertEqual(result.userId, "user-1");
      assertEqual(result.roles.length, 1);
    },
  },
  {
    name: "IdentityRuntime resolves workspace from organization",
    run: async () => {
      const auth = await identity.authenticate({
        channel: "api",
        rawPayload: {},
        headers: { authorization: "Bearer user-1" },
      });
      const workspace = await identity.resolveWorkspace(auth);
      assertEqual(workspace.id, "org-1");
    },
  },
];

async function runTests(): Promise<void> {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
}

runTests();
