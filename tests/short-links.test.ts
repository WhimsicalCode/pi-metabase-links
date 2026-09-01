import assert from "node:assert/strict";
import test from "node:test";

import {
  SHORT_LINK_CREATE_EVENT,
  requestShortLink,
  type ShortLinkCreateRequestV1,
} from "../src/short-links.ts";

test("requestShortLink emits the versioned request and reports it unclaimed", async () => {
  let eventName: string | undefined;
  let request: ShortLinkCreateRequestV1 | undefined;
  const events = {
    emit(name: string, data: unknown) {
      eventName = name;
      request = data as ShortLinkCreateRequestV1;
    },
  };

  const attempt = await requestShortLink(events, {
    url: "https://metabase.example.com/question#payload",
    title: "Monthly users",
  });

  assert.equal(eventName, SHORT_LINK_CREATE_EVENT);
  assert.equal(SHORT_LINK_CREATE_EVENT, "pi-short-links:create:v1");
  assert.deepEqual(request!.input, {
    url: "https://metabase.example.com/question#payload",
    title: "Monthly users",
  });
  assert.deepEqual(attempt, { claimed: false });
});

test("requestShortLink awaits the first service that claims the request", async () => {
  const events = {
    emit(_name: string, data: unknown) {
      const request = data as ShortLinkCreateRequestV1;
      assert.equal(request.claim(), true);
      assert.equal(request.claim(), false);
      queueMicrotask(() => {
        request.resolve({
          shortUrl: "http://127.0.0.1:8765/s/monthly-users-abc",
          localOnly: true,
          warnings: [],
        });
      });
    },
  };

  assert.deepEqual(
    await requestShortLink(events, {
      url: "https://metabase.example.com/question#payload",
    }),
    {
      claimed: true,
      result: {
        shortUrl: "http://127.0.0.1:8765/s/monthly-users-abc",
        localOnly: true,
        warnings: [],
      },
    },
  );
});
