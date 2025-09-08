import { Client, auth } from "cassandra-driver";
import { randomUUID } from "crypto";

export interface UserRecord {
  gryt_user_id: string; // Internal Gryt Auth user ID (never exposed)
  server_user_id: string; // Secret server user ID (never exposed to clients)
  nickname: string;
  created_at: Date;
  last_seen: Date;
  last_token_refresh?: Date; // Track when token was last refreshed
}

export interface MessageRecord {
  conversation_id: string;
  message_id: string; // uuid string
  sender_server_id: string; // Secret server user ID (never exposed)
  sender_nickname: string;
  text: string | null;
  created_at: Date;
  attachments: string[] | null; // file_id uuid strings
}

export interface FileRecord {
  file_id: string; // uuid string
  s3_key: string;
  mime: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  thumbnail_key: string | null;
  created_at: Date;
}

let client: Client | null = null;

export function getScyllaClient(): Client {
  if (!client) throw new Error("Scylla client not initialized. Call initScylla() first.");
  return client;
}

export async function initScylla(): Promise<void> {
  const contactPoints = (process.env.SCYLLA_CONTACT_POINTS || "127.0.0.1").split(",").map((s) => s.trim());
  const localDataCenter = process.env.SCYLLA_LOCAL_DATACENTER || "datacenter1";
  const keyspace = process.env.SCYLLA_KEYSPACE || "gryt";

  const username = process.env.SCYLLA_USERNAME;
  const password = process.env.SCYLLA_PASSWORD;

  const commonConfig: any = {
    contactPoints,
    localDataCenter,
    ...(username && password
      ? { authProvider: new auth.PlainTextAuthProvider(username, password) }
      : {}),
  };

  // temp client without keyspace to create it if missing
  const temp = new Client(commonConfig);
  await temp.connect();
  await temp.execute(
    `CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}`
  );
  await temp.shutdown();

  // main client using keyspace
  client = new Client({ ...commonConfig, keyspace });
  await client.connect();

  await client.execute(
    `CREATE TABLE IF NOT EXISTS users_by_gryt_id (
      gryt_user_id text PRIMARY KEY,
      server_user_id text,
      nickname text,
      created_at timestamp,
      last_seen timestamp
    )`
  );

  await client.execute(
    `CREATE TABLE IF NOT EXISTS users_by_server_id (
      server_user_id text PRIMARY KEY,
      gryt_user_id text,
      nickname text,
      created_at timestamp,
      last_seen timestamp
    )`
  );

  await client.execute(
    `CREATE TABLE IF NOT EXISTS messages_by_conversation (
      conversation_id text,
      created_at timestamp,
      message_id uuid,
      sender_server_id text,
      sender_nickname text,
      text text,
      attachments list<text>,
      PRIMARY KEY ((conversation_id), created_at, message_id)
    ) WITH CLUSTERING ORDER BY (created_at ASC, message_id ASC)`
  );

  await client.execute(
    `CREATE TABLE IF NOT EXISTS files_by_id (
      file_id uuid PRIMARY KEY,
      s3_key text,
      mime text,
      size bigint,
      width int,
      height int,
      thumbnail_key text,
      created_at timestamp
    )`
  );
}

export async function upsertUser(grytUserId: string, nickname: string): Promise<UserRecord> {
  const c = getScyllaClient();
  const now = new Date();
  const serverUserId = `user_${randomUUID()}`; // Generate unique server user ID
  
  console.log(`👤 Upserting user:`, { grytUserId, serverUserId, nickname });
  
  try {
    // Insert into both tables for efficient lookups
    await c.execute(
      `INSERT INTO users_by_gryt_id (gryt_user_id, server_user_id, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, ?)`,
      [grytUserId, serverUserId, nickname, now, now],
      { prepare: true }
    );
    
    await c.execute(
      `INSERT INTO users_by_server_id (server_user_id, gryt_user_id, nickname, created_at, last_seen) VALUES (?, ?, ?, ?, ?)`,
      [serverUserId, grytUserId, nickname, now, now],
      { prepare: true }
    );
    
    console.log(`✅ User successfully upserted:`, { grytUserId, serverUserId });
    return { 
      gryt_user_id: grytUserId, 
      server_user_id: serverUserId, 
      nickname,
      created_at: now, 
      last_seen: now 
    };
  } catch (error) {
    console.error(`❌ Failed to upsert user:`, error);
    throw error;
  }
}

export async function getUserByGrytId(grytUserId: string): Promise<UserRecord | null> {
  const c = getScyllaClient();
  
  try {
    const rs = await c.execute(
      `SELECT gryt_user_id, server_user_id, nickname, created_at, last_seen FROM users_by_gryt_id WHERE gryt_user_id = ?`,
      [grytUserId],
      { prepare: true }
    );
    const r = rs.first();
    if (!r) return null;
    return {
      gryt_user_id: r["gryt_user_id"],
      server_user_id: r["server_user_id"],
      nickname: r["nickname"],
      created_at: r["created_at"],
      last_seen: r["last_seen"],
    };
  } catch (error) {
    console.error(`❌ Failed to get user by Gryt ID:`, error);
    throw error;
  }
}

export async function getUserByServerId(serverUserId: string): Promise<UserRecord | null> {
  const c = getScyllaClient();
  
  try {
    const rs = await c.execute(
      `SELECT server_user_id, gryt_user_id, nickname, created_at, last_seen FROM users_by_server_id WHERE server_user_id = ?`,
      [serverUserId],
      { prepare: true }
    );
    const r = rs.first();
    if (!r) return null;
    return {
      gryt_user_id: r["gryt_user_id"],
      server_user_id: r["server_user_id"],
      nickname: r["nickname"],
      created_at: r["created_at"],
      last_seen: r["last_seen"],
    };
  } catch (error) {
    console.error(`❌ Failed to get user by server ID:`, error);
    throw error;
  }
}

export async function insertMessage(record: Omit<MessageRecord, "message_id" | "created_at"> & { created_at?: Date; message_id?: string }): Promise<MessageRecord> {
  const c = getScyllaClient();
  const created_at = record.created_at ?? new Date();
  const message_id = record.message_id ?? randomUUID();
  
  console.log(`💾 Inserting message to ScyllaDB:`, {
    conversation_id: record.conversation_id,
    message_id,
    sender_server_id: record.sender_server_id,
    sender_nickname: record.sender_nickname,
    text_length: record.text?.length || 0,
    has_attachments: !!record.attachments?.length
  });
  
  try {
    await c.execute(
      `INSERT INTO messages_by_conversation (conversation_id, created_at, message_id, sender_server_id, sender_nickname, text, attachments) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [record.conversation_id, created_at, message_id, record.sender_server_id, record.sender_nickname, record.text ?? null, record.attachments ?? null],
      { prepare: true }
    );
    console.log(`✅ Message successfully inserted to ScyllaDB:`, { message_id });
    return { ...record, created_at, message_id } as MessageRecord;
  } catch (error) {
    console.error(`❌ Failed to insert message to ScyllaDB:`, error);
    throw error;
  }
}

export async function listMessages(conversationId: string, limit = 50, before?: Date): Promise<MessageRecord[]> {
  const c = getScyllaClient();
  
  console.log(`📖 Fetching messages from ScyllaDB:`, {
    conversation_id: conversationId,
    limit,
    before: before?.toISOString()
  });
  
  try {
    if (before) {
      const rs = await c.execute(
        `SELECT conversation_id, created_at, message_id, sender_server_id, sender_nickname, text, attachments FROM messages_by_conversation WHERE conversation_id = ? AND created_at < ? LIMIT ?`,
        [conversationId, before, limit],
        { prepare: true }
      );
      const messages = rs.rows.map((r) => ({
        conversation_id: r["conversation_id"],
        created_at: r["created_at"],
        message_id: r["message_id"].toString(),
        sender_server_id: r["sender_server_id"],
        sender_nickname: r["sender_nickname"],
        text: r["text"],
        attachments: r["attachments"] ?? null,
      }));
      console.log(`✅ Fetched ${messages.length} messages from ScyllaDB (with before filter)`);
      return messages;
    }
    const rs = await c.execute(
      `SELECT conversation_id, created_at, message_id, sender_server_id, sender_nickname, text, attachments FROM messages_by_conversation WHERE conversation_id = ? LIMIT ?`,
      [conversationId, limit],
      { prepare: true }
    );
    const messages = rs.rows.map((r) => ({
      conversation_id: r["conversation_id"],
      created_at: r["created_at"],
      message_id: r["message_id"].toString(),
      sender_server_id: r["sender_server_id"],
      sender_nickname: r["sender_nickname"],
      text: r["text"],
      attachments: r["attachments"] ?? null,
    }));
    console.log(`✅ Fetched ${messages.length} messages from ScyllaDB`);
    return messages;
  } catch (error) {
    console.error(`❌ Failed to fetch messages from ScyllaDB:`, error);
    throw error;
  }
}

export async function insertFile(record: Omit<FileRecord, "created_at"> & { created_at?: Date }): Promise<FileRecord> {
  const c = getScyllaClient();
  const created_at = record.created_at ?? new Date();
  await c.execute(
    `INSERT INTO files_by_id (file_id, s3_key, mime, size, width, height, thumbnail_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.file_id, record.s3_key, record.mime ?? null, record.size ?? null, record.width ?? null, record.height ?? null, record.thumbnail_key ?? null, created_at],
    { prepare: true }
  );
  return { ...record, created_at };
}

export async function getFile(fileId: string): Promise<FileRecord | null> {
  const c = getScyllaClient();
  const rs = await c.execute(
    `SELECT file_id, s3_key, mime, size, width, height, thumbnail_key, created_at FROM files_by_id WHERE file_id = ?`,
    [fileId],
    { prepare: true }
  );
  const r = rs.first();
  if (!r) return null;
  return {
    file_id: r["file_id"].toString(),
    s3_key: r["s3_key"],
    mime: r["mime"],
    size: Number(r["size"] ?? 0),
    width: r["width"],
    height: r["height"],
    thumbnail_key: r["thumbnail_key"],
    created_at: r["created_at"],
  };
} 