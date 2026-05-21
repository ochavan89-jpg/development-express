const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const app = require("../server");

function request(server, method, path, body) {
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        path,
        port: server.address().port,
        host: "127.0.0.1",
        headers: payload
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test("mounts auth routes under /api/auth", async (t) => {
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));

  const response = await request(server, "POST", "/api/auth/login", {});

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /Username and password required/);
});

test("mounts protected resource routes under /api", async (t) => {
  const server = http.createServer(app).listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));

  const response = await request(server, "GET", "/api/machines");

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /No token provided/);
});
