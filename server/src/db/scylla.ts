import { Client, auth } from "cassandra-driver";
import { randomUUID } from "crypto";

export interface MessageRecord {
  conversation_id: string;
  message_id: string; // uuid string
  sender_id: string;
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
    `CREATE TABLE IF NOT EXISTS messages_by_conversation (
      conversation_id text,
      created_at timestamp,
      message_id uuid,
      sender_id text,
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

export async function insertMessage(record: Omit<MessageRecord, "message_id" | "created_at"> & { created_at?: Date; message_id?: string }): Promise<MessageRecord> {
  const c = getScyllaClient();
  const created_at = record.created_at ?? new Date();
  const message_id = record.message_id ?? randomUUID();
  await c.execute(
    `INSERT INTO messages_by_conversation (conversation_id, created_at, message_id, sender_id, text, attachments) VALUES (?, ?, ?, ?, ?, ?)`,
    [record.conversation_id, created_at, message_id, record.sender_id, record.text ?? null, record.attachments ?? null],
    { prepare: true }
  );
  return { ...record, created_at, message_id } as MessageRecord;
}

export async function listMessages(conversationId: string, limit = 50, before?: Date): Promise<MessageRecord[]> {
  const c = getScyllaClient();
  if (before) {
    const rs = await c.execute(
      `SELECT conversation_id, created_at, message_id, sender_id, text, attachments FROM messages_by_conversation WHERE conversation_id = ? AND created_at < ? LIMIT ?`,
      [conversationId, before, limit],
      { prepare: true }
    );
    return rs.rows.map((r) => ({
      conversation_id: r["conversation_id"],
      created_at: r["created_at"],
      message_id: r["message_id"].toString(),
      sender_id: r["sender_id"],
      text: r["text"],
      attachments: r["attachments"] ?? null,
    }));
  }
  const rs = await c.execute(
    `SELECT conversation_id, created_at, message_id, sender_id, text, attachments FROM messages_by_conversation WHERE conversation_id = ? LIMIT ?`,
    [conversationId, limit],
    { prepare: true }
  );
  return rs.rows.map((r) => ({
    conversation_id: r["conversation_id"],
    created_at: r["created_at"],
    message_id: r["message_id"].toString(),
    sender_id: r["sender_id"],
    text: r["text"],
    attachments: r["attachments"] ?? null,
  }));
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