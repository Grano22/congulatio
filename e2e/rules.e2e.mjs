import { FIRESTORE_URL, STORAGE_URL, Suite, signUpAnonymous } from './support.mjs';

const row = (owner, extra = {}) => ({
  fields: {
    owner: { stringValue: owner },
    kind: { stringValue: 'characters' },
    entityId: { stringValue: 'x' },
    position: { integerValue: '0' },
    json: { stringValue: '{}' },
    hash: { stringValue: 'h' },
    bytes: { integerValue: '2' },
    updatedAt: { stringValue: new Date().toISOString() },
    ...extra,
  },
});

const request = async (who, method, path, body) =>
  (
    await fetch(`${FIRESTORE_URL}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${who.token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  ).status;

const rowPath = (id) => `app_tables/${encodeURIComponent(id)}`;
const create = (who, id, body) => request(who, 'POST', `app_tables?documentId=${encodeURIComponent(id)}`, body);
const update = (who, id, body) => request(who, 'PATCH', rowPath(id), body);

const query = async (who, owner) =>
  (
    await fetch(`${FIRESTORE_URL}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${who.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'app_tables' }],
          ...(owner ? { where: { fieldFilter: { field: { fieldPath: 'owner' }, op: 'EQUAL', value: { stringValue: owner } } } } : {}),
        },
      }),
    })
  ).status;

const upload = async (who, path, type, size) =>
  (
    await fetch(`${STORAGE_URL}?name=${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: { Authorization: `Firebase ${who.token}`, 'content-type': type },
      body: new Uint8Array(size),
    })
  ).status;

export async function rulesSuite() {
  const suite = new Suite('Security rules');
  const allowed = (label, status) => suite.check(label, status < 300, `HTTP ${status}`);
  const denied = (label, status) => suite.check(label, status === 403, `HTTP ${status}`);
  const a = await signUpAnonymous();
  const b = await signUpAnonymous();
  const own = `${a.uid}~characters~x`;

  allowed('an owner creates a row under their own id prefix', await create(a, own, row(a.uid)));
  denied('another user cannot squat on an id with the owner prefix', await create(b, `${a.uid}~characters~squat`, row(b.uid)));
  denied('a user cannot create a row claiming someone else as owner', await create(b, `${b.uid}~characters~fake`, row(a.uid)));
  denied('another user cannot overwrite a row', await update(b, own, row(b.uid)));
  denied('another user cannot edit a row while keeping its owner', await update(b, own, row(a.uid)));
  denied('another user cannot read a row', await request(b, 'GET', rowPath(own)));
  denied('another user cannot query rows by owner', await query(b, a.uid));
  denied('nobody can list every row', await query(b, null));
  allowed('an owner queries their own rows', await query(a, a.uid));
  denied('an owner cannot add unknown fields', await update(a, own, row(a.uid, { role: { stringValue: 'admin' } })));
  denied('an owner cannot hand a row to another user', await update(a, own, row(b.uid)));
  denied('another user cannot delete a row', await request(b, 'DELETE', rowPath(own)));
  allowed('an owner deletes their own row', await request(a, 'DELETE', rowPath(own)));
  denied('another user cannot read a profile', await request(b, 'GET', `users/${a.uid}`));
  allowed('a user writes their own profile', await request(a, 'PATCH', `users/${a.uid}`, { fields: { displayName: { stringValue: 'A' } } }));
  denied('a user cannot set an admin flag on their profile', await request(a, 'PATCH', `users/${a.uid}`, { fields: { admin: { booleanValue: true } } }));
  denied('a regular user cannot read admin tables', await request(a, 'GET', 'admin_tables/any'));
  denied('a user cannot write outside the known collections', await request(a, 'PATCH', 'secrets/any', { fields: { x: { stringValue: 'y' } } }));

  allowed('a user uploads their own avatar', await upload(a, `avatars/${a.uid}/avatar.webp`, 'image/webp', 1000));
  denied('another user cannot upload into that avatar folder', await upload(b, `avatars/${a.uid}/avatar.webp`, 'image/webp', 1000));
  denied('an avatar above 512 KiB is refused', await upload(a, `avatars/${a.uid}/avatar.webp`, 'image/webp', 600 * 1024));
  denied('a non-image avatar is refused', await upload(a, `avatars/${a.uid}/avatar.webp`, 'text/html', 100));
  denied('nothing can be uploaded outside the avatars folder', await upload(a, `public/${a.uid}.png`, 'image/png', 100));
  return suite;
}
