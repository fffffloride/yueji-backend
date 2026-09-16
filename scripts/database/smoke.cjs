// Runs only against the disposable database/Redis supplied by integration.py.
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
require('reflect-metadata');
const { NestFactory, Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../../dist/app.module');
const { ResponseInterceptor } = require('../../dist/common/interceptors/response.interceptor');

(async () => {
  assert.equal(process.env.DATABASE_SMOKE_TEST, 'disposable');
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  try {
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
    const timestamp = String(Math.floor(Date.now()/1000));
    const signature = createHmac('sha256', process.env.JWT_SECRET_KEY)
      .update(`yueji-release-readiness:v1:${timestamp}`).digest('hex');
    const readiness = await fetch(base+'/internal/readiness', {headers: {
      'x-readiness-time':timestamp, 'x-readiness-signature':signature }});
    assert.equal(readiness.status, 200);
    assert.equal((await readiness.json()).data.ready, true);
    assert.equal((await fetch(base+'/internal/readiness')).status, 401);
    // Test credentials and fixtures exist only in the disposable environment.
    const token = app.get(JwtService).sign({sub:'1',username:'admin',roles:['ROOT']}, {expiresIn:60});
    for (const route of ['/appointments/config','/appointments/page?pageSize=1',
      '/appointments/summary','/orders/page?pageSize=1','/orders/90001']) {
      const response = await fetch(base+route, {headers:{Authorization:'Bearer '+token}});
      assert.equal(response.status, 200, route);
      assert.equal((await response.json()).code, '00000', route);
    }
    console.log('BUSINESS_HTTP_SMOKE_OK');
  } finally { await app.close(); }
})().then(()=>process.exit(0)).catch(error=>{
  console.error('BUSINESS_HTTP_SMOKE_FAILED '+error.message); process.exit(1);
});
