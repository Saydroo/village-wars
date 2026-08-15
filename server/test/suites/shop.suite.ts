import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, registerPlayer, grant, uniqueSuffix } from '../harness';

async function skinList(token: string): Promise<any[]> {
  const res = await api('GET', '/api/shop/skins', { token });
  assert.equal(res.status, 200);
  return res.body.skins;
}

test('Skin-Galerie listet die geseedeten Skins (mit Besitz/Anwendung)', async () => {
  const p = await registerPlayer();
  const skins = await skinList(p.token);
  assert.ok(skins.length >= 1);
  for (const s of skins) {
    assert.equal(s.owned, false);
    assert.equal(s.applied, false);
    assert.equal(typeof s.price_bars, 'number');
  }
});

test('Skin kaufen → Besitz; Doppelkauf → 409', async () => {
  const p = await registerPlayer();
  const skins = await skinList(p.token);
  const skin = skins[0];
  await grant(p.id, { gold_bars: skin.price_bars + 100 });

  const buy = await api('POST', `/api/shop/skins/${skin.id}/buy`, { token: p.token });
  assert.equal(buy.status, 200);
  const after = await skinList(p.token);
  assert.equal(after.find((s) => s.id === skin.id).owned, true);

  const again = await api('POST', `/api/shop/skins/${skin.id}/buy`, { token: p.token });
  assert.equal(again.status, 409);
});

test('Skin kaufen ohne genug Goldbarren → 400', async () => {
  const p = await registerPlayer();
  const skins = await skinList(p.token);
  const skin = skins[0];
  await grant(p.id, { gold_bars: 0 });
  const buy = await api('POST', `/api/shop/skins/${skin.id}/buy`, { token: p.token });
  assert.equal(buy.status, 400);
});

test('Skin anwenden/entfernen schaltet applied um', async () => {
  const p = await registerPlayer();
  const skins = await skinList(p.token);
  const skin = skins[0];
  await grant(p.id, { gold_bars: skin.price_bars + 100 });
  await api('POST', `/api/shop/skins/${skin.id}/buy`, { token: p.token });

  await api('POST', `/api/shop/skins/${skin.id}/apply`, { token: p.token });
  assert.equal((await skinList(p.token)).find((s) => s.id === skin.id).applied, true);

  await api('POST', `/api/shop/skins/${skin.id}/unapply`, { token: p.token });
  assert.equal((await skinList(p.token)).find((s) => s.id === skin.id).applied, false);
});

test('Skin anwenden ohne Besitz → 400', async () => {
  const p = await registerPlayer();
  const skins = await skinList(p.token);
  const res = await api('POST', `/api/shop/skins/${skins[0].id}/apply`, { token: p.token });
  assert.equal(res.status, 400);
});

test('IAP-Goldbarren-Pakete abrufbar', async () => {
  const p = await registerPlayer();
  const res = await api('GET', '/api/shop/bars/packages', { token: p.token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.packages) && res.body.packages.length > 0);
});

test('IAP Sandbox-Kauf schreibt Goldbarren gut + ist idempotent (gleiche txid)', async () => {
  const p = await registerPlayer();
  const pkgs = (await api('GET', '/api/shop/bars/packages', { token: p.token })).body.packages;
  const pkg = pkgs[0];
  const txid = `tx_${uniqueSuffix()}`;
  const body = {
    platform: 'apple',
    product_id: pkg.product_id,
    receipt: `sandbox:${pkg.product_id}:${txid}`,
  };

  const before = (await api('GET', '/api/player/me', { token: p.token })).body.player.gold_bars;
  const first = await api('POST', '/api/shop/bars/purchase', { token: p.token, body });
  assert.equal(first.status, 200);
  assert.equal(first.body.already_processed, false);
  assert.equal(first.body.bars_credited, pkg.bars);

  const second = await api('POST', '/api/shop/bars/purchase', { token: p.token, body });
  assert.equal(second.status, 200);
  assert.equal(second.body.already_processed, true);
  assert.equal(second.body.bars_credited, 0);

  const after = (await api('GET', '/api/player/me', { token: p.token })).body.player.gold_bars;
  assert.equal(after, before + pkg.bars); // nur EINMAL gutgeschrieben
});

test('IAP unbekanntes Produkt → 400; Beleg/Produkt-Mismatch → 400', async () => {
  const p = await registerPlayer();
  const pkgs = (await api('GET', '/api/shop/bars/packages', { token: p.token })).body.packages;
  const pkg = pkgs[0];

  const unknown = await api('POST', '/api/shop/bars/purchase', {
    token: p.token,
    body: { platform: 'apple', product_id: 'kein_produkt', receipt: `sandbox:kein_produkt:tx_${uniqueSuffix()}` },
  });
  assert.equal(unknown.status, 400);

  const mismatch = await api('POST', '/api/shop/bars/purchase', {
    token: p.token,
    body: { platform: 'apple', product_id: pkg.product_id, receipt: `sandbox:anderes_produkt:tx_${uniqueSuffix()}` },
  });
  assert.equal(mismatch.status, 400);
});
