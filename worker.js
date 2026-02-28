const json = (payload, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders }
  });

const WALLET_ADDRESS = 'UQBu-4JdgbIdHIYqj2tUazFi9iQ3BIpypK-akdmbnT1KbO9Q';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/public/runtime') {
      return json({
        ok: true,
        runtime: {
          payments: {
            wallet_ton: {
              recipient: '@wallet',
              endpoint: '',
              network: 'TON',
              wallet: WALLET_ADDRESS
            }
          }
        }
      });
    }

    if (url.pathname === '/api/payments/telegram-crypto/create') {
      return json({
        ok: true,
        mode: 'manual_wallet',
        network: 'TON',
        wallet: WALLET_ADDRESS,
        message: 'Backend недоступен в static Worker-режиме: используйте ручной перевод TON на @wallet.'
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return json(
        {
          ok: false,
          error: 'Backend API недоступен в этом static Worker deployment.',
          hint: 'Для полного API поднимите server.js в Node-среде. В этом режиме доступны только фронтенд и ручная оплата через @wallet (TON).',
          wallet: WALLET_ADDRESS
        },
        501
      );
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }
};
