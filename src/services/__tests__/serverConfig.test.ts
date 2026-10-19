import { describe, it, expect } from 'vitest';
import app from '../../../server.ts';

describe('Server Configuration Endpoint (/api/config)', () => {
  it('handles /api/config and returns expected JSON shape', async () => {
    let responseStatus = 200;
    let responseJson: any = null;

    const req: any = {
      method: 'GET',
      url: '/api/config',
      headers: {},
    };

    await new Promise<void>((resolve) => {
      const res: any = {
        status(code: number) {
          responseStatus = code;
          return this;
        },
        json(data: any) {
          responseJson = data;
          resolve();
          return this;
        },
        setHeader() {
          return this;
        },
        end() {
          resolve();
        },
      };

      app(req, res);
    });

    expect(responseStatus).toBe(200);
    expect(responseJson).toBeDefined();
    expect(responseJson).toHaveProperty('mapsKey');
    expect(responseJson).toHaveProperty('mapId');
    expect(responseJson).toHaveProperty('useRoutes');
    expect(responseJson).toHaveProperty('useGoogleGeocoding');
    expect(typeof responseJson.useRoutes).toBe('boolean');
    expect(typeof responseJson.useGoogleGeocoding).toBe('boolean');
  });

  it('normalizes rewrites without /api prefix (e.g. /config on Vercel)', async () => {
    let responseStatus = 200;
    let responseJson: any = null;

    const req: any = {
      method: 'GET',
      url: '/config',
      headers: {},
    };

    await new Promise<void>((resolve) => {
      const res: any = {
        status(code: number) {
          responseStatus = code;
          return this;
        },
        json(data: any) {
          responseJson = data;
          resolve();
          return this;
        },
        setHeader() {
          return this;
        },
        end() {
          resolve();
        },
      };

      app(req, res);
    });

    expect(responseStatus).toBe(200);
    expect(responseJson).toHaveProperty('mapsKey');
    expect(responseJson).toHaveProperty('mapId');
  });
});
