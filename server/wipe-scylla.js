#!/usr/bin/env node
require('dotenv').config();
const readline = require('node:readline');
const { Client, auth } = require('cassandra-driver');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: 'drop',
    force: false,
    recreate: false,
    replication: null,
    keyspace: null,
    includeSystem: false
  };
  for (const a of args) {
    if (a.startsWith('--mode=')) opts.mode = a.split('=')[1];
    else if (a.startsWith('--keyspace=')) opts.keyspace = a.split('=')[1];
    else if (a === '--force') opts.force = true;
    else if (a === '--recreate') opts.recreate = true;
    else if (a.startsWith('--replication=')) opts.replication = Number(a.split('=')[1]);
    else if (a === '--include-system') opts.includeSystem = true;
    else console.warn(`Unknown arg: ${a}`);
  }
  if (!['drop', 'truncate'].includes(opts.mode)) {
    console.error('Invalid --mode. Use "drop" (default) or "truncate".');
    process.exit(2);
  }
  return opts;
}

function getEnv(name, required = true, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (required && (!v || !String(v).trim())) {
    console.error(`Missing required env: ${name}`);
    process.exit(2);
  }
  return v;
}

function rlAsk(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (ans) => { rl.close(); res(ans.trim()); }));
}

async function confirmOrExit(message, force) {
  if (force) return;
  const ans = await rlAsk(`${message} Type "YES" to proceed: `);
  if (ans !== 'YES') {
    console.log('Aborted.');
    process.exit(0);
  }
}

function buildClient() {
  const contactPoints = getEnv('SCYLLA_CONTACT_POINTS').split(',').map(s => s.trim()).filter(Boolean);
  const localDataCenter = getEnv('SCYLLA_LOCAL_DATACENTER');
  const username = getEnv('SCYLLA_USERNAME');
  const password = getEnv('SCYLLA_PASSWORD');
  const authProvider = new auth.PlainTextAuthProvider(username, password);

  return new Client({
    contactPoints,
    localDataCenter,
    authProvider,
    queryOptions: { consistency: 1 },
  });
}

async function fetchKeyspaces(client, includeSystem) {
  const rs = await client.execute('SELECT keyspace_name FROM system_schema.keyspaces');
  let ks = rs.rows.map(r => r['keyspace_name']).sort((a, b) => a.localeCompare(b));
  if (!includeSystem) {
    ks = ks.filter(k => !k.startsWith('system') && !k.startsWith('virtual'));
  }
  return ks;
}

async function pickKeyspaceInteractive(client, includeSystem, suggested) {
  const ks = await fetchKeyspaces(client, includeSystem);
  if (ks.length === 0) {
    console.error('No keyspaces found to choose from.');
    process.exit(2);
  }

  console.log('\nAvailable keyspaces:');
  ks.forEach((k, i) => {
    const mark = suggested && suggested === k ? ' (default from .env)' : '';
    console.log(`${String(i + 1).padStart(2, ' ')}. ${k}${mark}`);
  });

  const defIndex = suggested ? ks.indexOf(suggested) : -1;
  const prompt = defIndex >= 0
    ? `\nSelect a keyspace by number (1-${ks.length}) [default ${defIndex + 1}]: `
    : `\nSelect a keyspace by number (1-${ks.length}): `;

  while (true) {
    const ans = await rlAsk(prompt);
    if (!ans && defIndex >= 0) return ks[defIndex];
    const n = Number(ans);
    if (Number.isInteger(n) && n >= 1 && n <= ks.length) return ks[n - 1];
    console.log(`Please enter a valid number between 1 and ${ks.length}.`);
  }
}

async function dropKeyspace(client, keyspace) {
  console.log(`Dropping keyspace "${keyspace}"...`);
  await client.execute(`DROP KEYSPACE IF EXISTS "${keyspace}";`);
  console.log('Keyspace dropped.');
}

async function recreateKeyspace(client, keyspace, dc, rf) {
  const replication = `{'class': 'NetworkTopologyStrategy', '${dc}': ${rf}}`;
  console.log(`Recreating keyspace "${keyspace}" with replication ${replication}...`);
  await client.execute(
    `CREATE KEYSPACE IF NOT EXISTS "${keyspace}" WITH replication = ${replication};`
  );
  console.log('Keyspace recreated.');
}

async function truncateAllTables(client, keyspace) {
  const rs = await client.execute(
    'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?',
    [keyspace],
    { prepare: true }
  );
  const tables = rs.rows.map(r => r['table_name']);
  if (tables.length === 0) {
    console.log('No tables found to truncate.');
    return;
  }
  console.log(`Truncating ${tables.length} table(s): ${tables.join(', ')}`);
  for (const t of tables) {
    const fq = `"${keyspace}"."${t}"`;
    process.stdout.write(`  TRUNCATE ${fq} ... `);
    await client.execute(`TRUNCATE ${fq};`);
    console.log('OK');
  }
}

(async function main() {
  const opts = parseArgs();
  const envDefaultKeyspace = getEnv('SCYLLA_KEYSPACE', false, '').trim() || null;
  const dc = getEnv('SCYLLA_LOCAL_DATACENTER');
  const rf = Number(opts.replication || 3);

  const client = buildClient();

  try {
    await client.connect();
    console.log('Connected to Scylla.');

    let keyspace = opts.keyspace;
    if (!keyspace) {
      keyspace = await pickKeyspaceInteractive(client, opts.includeSystem, envDefaultKeyspace);
    }

    if (opts.mode === 'drop') {
      await confirmOrExit(
        `This will DROP the entire keyspace "${keyspace}" (all data & schema).`,
        opts.force
      );
      await dropKeyspace(client, keyspace);
      if (opts.recreate) {
        await recreateKeyspace(client, keyspace, dc, rf);
      }
    } else {
      await confirmOrExit(
        `This will TRUNCATE ALL TABLES in keyspace "${keyspace}" (data only).`,
        opts.force
      );
      await truncateAllTables(client, keyspace);
    }

    console.log('Done.');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    await client.shutdown().catch(() => {});
  }
})();
