import { INestApplication } from "@nestjs/common";
import { Writable } from "stream";
import request from "supertest";
import { logTestSink } from "../../src/common/logging/redact";
import { createTestApp, cleanupDb, createTestUser } from "../helpers/test-app";

describe("Redação de segredos nos logs HTTP (AppModule real)", () => {
  let app: INestApplication;
  let saida = "";
  let fx: { adminEmail: string; adminPassword: string };

  beforeAll(async () => {
    logTestSink.stream = new Writable({
      write(chunk, _e, cb) {
        saida += chunk.toString();
        cb();
      },
    });
    app = await createTestApp({ LOG_LEVEL: "info" });
    fx = await createTestUser(app, { perfil: "administrador" });
  });

  afterAll(async () => {
    logTestSink.stream = undefined;
    await cleanupDb(app);
    await app.close();
  });

  const segredos = {
    Cookie: "access_token=SEGREDO_COOKIE",
    Authorization: "Bearer SEGREDO_BEARER",
    "x-access-token": "SEGREDO_XTOKEN",
    "proxy-authorization": "SEGREDO_PROXY",
    "x-api-key": "SEGREDO_APIKEY",
  };

  const comSegredos = (r: request.Test) => r.set(segredos);

  it("mascara headers sensíveis em 404, 401 e 400 (validação)", async () => {
    const http = app.getHttpServer();
    await comSegredos(request(http).get("/rota-inexistente"));
    await comSegredos(request(http).get("/auth/me"));
    await comSegredos(request(http).post("/auth/login")).send({ email: "x" });
    await new Promise((r) => setTimeout(r, 100));
    expect(saida).toContain("[REDACTED]");
    expect(saida).not.toMatch(/SEGREDO_/);
  });

  it("login com senha errada e certa não vaza a senha nem o token", async () => {
    saida = "";
    const http = app.getHttpServer();
    const ruim = await request(http)
      .post("/auth/login")
      .send({ email: fx.adminEmail, password: "SEGREDO_SENHA_ERRADA" });
    expect(ruim.status).toBe(401);
    const ok = await request(http)
      .post("/auth/login")
      .send({ email: fx.adminEmail, password: fx.adminPassword });
    expect(ok.status).toBe(200);
    const cookies = ([] as string[]).concat(
      ok.headers["set-cookie"] as unknown as string[],
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(saida).toContain("[REDACTED]");
    expect(saida).not.toContain("SEGREDO_SENHA_ERRADA");
    expect(saida).not.toContain(fx.adminPassword);
    for (const c of cookies)
      expect(saida).not.toContain(c.split(";")[0].split("=")[1]);
  });
});
