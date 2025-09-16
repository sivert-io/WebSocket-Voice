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

export interface Reaction {
  src: string; // Image source/URL for the reaction
  amount: number; // Count of users who reacted with this image
  users: string[]; // Array of server_user_ids who reacted with this image
}

export interface MessageRecord {
  conversation_id: string;
  message_id: string; // uuid string
  sender_server_id: string; // Secret server user ID (never exposed)
  text: string | null;
  created_at: Date;
  attachments: string[] | null; // file_id uuid strings
  reactions: Reaction[] | null; // Array of reactions to this message
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
      text text,
      attachments list<text>,
      reactions text,
      PRIMARY KEY ((conversation_id), created_at, message_id)
    ) WITH CLUSTERING ORDER BY (created_at ASC, message_id ASC)`
  );

  // Add reactions column if it doesn't exist (for existing tables)
  try {
    await client.execute(`ALTER TABLE messages_by_conversation ADD reactions text`);
  } catch (error: any) {
    // Column already exists or other error - ignore if it's about column already existing
    if (!error.message?.includes('already exists') && !error.message?.includes('Invalid column name')) {
      console.warn('Warning: Could not add reactions column:', error.message);
    }
  }

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
  
  console.log(`👤 Upserting user:`, { grytUserId, nickname });
  
  try {
    // First, check if user already exists
    const existingUser = await getUserByGrytId(grytUserId);
    
    if (existingUser) {
      // User exists, update their nickname and last_seen
      const serverUserId = existingUser.server_user_id;
      
      console.log(`👤 User exists, updating:`, { grytUserId, serverUserId, nickname });
      
      await c.execute(
        `UPDATE users_by_gryt_id SET nickname = ?, last_seen = ? WHERE gryt_user_id = ?`,
        [nickname, now, grytUserId],
        { prepare: true }
      );
      
      await c.execute(
        `UPDATE users_by_server_id SET nickname = ?, last_seen = ? WHERE server_user_id = ?`,
        [nickname, now, serverUserId],
        { prepare: true }
      );
      
      console.log(`✅ User successfully updated:`, { grytUserId, serverUserId });
      return { 
        gryt_user_id: grytUserId, 
        server_user_id: serverUserId, 
        nickname,
        created_at: existingUser.created_at, 
        last_seen: now 
      };
    } else {
      // User doesn't exist, create new one
      const serverUserId = `user_${randomUUID()}`; // Generate unique server user ID
      
      console.log(`👤 Creating new user:`, { grytUserId, serverUserId, nickname });
      
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
      
      console.log(`✅ User successfully created:`, { grytUserId, serverUserId });
      return { 
        gryt_user_id: grytUserId, 
        server_user_id: serverUserId, 
        nickname,
        created_at: now, 
        last_seen: now 
      };
    }
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
  
  // Serialize reactions to JSON string for storage
  const reactionsJson = record.reactions ? JSON.stringify(record.reactions) : null;
  
  console.log(`💾 Inserting message to ScyllaDB:`, {
    conversation_id: record.conversation_id,
    message_id,
    sender_server_id: record.sender_server_id,
    text_length: record.text?.length || 0,
    has_attachments: !!record.attachments?.length,
    has_reactions: !!record.reactions?.length
  });
  
  try {
    await c.execute(
      `INSERT INTO messages_by_conversation (conversation_id, created_at, message_id, sender_server_id, text, attachments, reactions) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [record.conversation_id, created_at, message_id, record.sender_server_id, record.text ?? null, record.attachments ?? null, reactionsJson],
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
        `SELECT conversation_id, created_at, message_id, sender_server_id, text, attachments, reactions FROM messages_by_conversation WHERE conversation_id = ? AND created_at < ? LIMIT ?`,
        [conversationId, before, limit],
        { prepare: true }
      );
      const messages = rs.rows.map((r) => ({
        conversation_id: r["conversation_id"],
        created_at: r["created_at"],
        message_id: r["message_id"].toString(),
        sender_server_id: r["sender_server_id"],
        text: r["text"],
        attachments: r["attachments"] ?? null,
        reactions: r["reactions"] ? JSON.parse(r["reactions"]) : null,
      }));
      console.log(`✅ Fetched ${messages.length} messages from ScyllaDB (with before filter)`);
      return messages;
    }
    const rs = await c.execute(
      `SELECT conversation_id, created_at, message_id, sender_server_id, text, attachments, reactions FROM messages_by_conversation WHERE conversation_id = ? LIMIT ?`,
      [conversationId, limit],
      { prepare: true }
    );
    const messages = rs.rows.map((r) => ({
      conversation_id: r["conversation_id"],
      created_at: r["created_at"],
      message_id: r["message_id"].toString(),
      sender_server_id: r["sender_server_id"],
      text: r["text"],
      attachments: r["attachments"] ?? null,
      reactions: r["reactions"] ? JSON.parse(r["reactions"]) : null,
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

export async function addReactionToMessage(
  conversationId: string, 
  messageId: string, 
  reactionSrc: string, 
  serverUserId: string
): Promise<MessageRecord | null> {
  // This function supports multi-reactions:
  // - Users can react with multiple different emojis on the same message
  // - Toggle behavior: clicking the same emoji again removes that reaction
  // - Each emoji type is tracked separately with its own user list
  const c = getScyllaClient();
  
  console.log(`👍 Adding reaction to message:`, {
    conversation_id: conversationId,
    message_id: messageId,
    reaction_src: reactionSrc,
    server_user_id: serverUserId
  });
  
  try {
    // First, get the current message to retrieve existing reactions
    const rs = await c.execute(
      `SELECT conversation_id, created_at, message_id, sender_server_id, text, attachments, reactions FROM messages_by_conversation WHERE conversation_id = ? AND message_id = ?`,
      [conversationId, messageId],
      { prepare: true }
    );
    
    const row = rs.first();
    if (!row) {
      console.log(`❌ Message not found:`, { conversationId, messageId });
      return null;
    }
    
    // Parse existing reactions
    let reactions: Reaction[] = row["reactions"] ? JSON.parse(row["reactions"]) : [];
    
    // Find existing reaction with the same src
    let existingReaction = reactions.find(r => r.src === reactionSrc);
    
    if (existingReaction) {
      // Check if user already reacted with this specific emoji
      if (existingReaction.users.includes(serverUserId)) {
        console.log(`⚠️ User already reacted with this emoji, removing reaction:`, { serverUserId, reactionSrc });
        // Remove user from this specific reaction (toggle behavior for same emoji)
        const userIndex = existingReaction.users.indexOf(serverUserId);
        existingReaction.users.splice(userIndex, 1);
        existingReaction.amount = existingReaction.users.length;
        
        // If no users left, remove the entire reaction
        if (existingReaction.amount === 0) {
          const reactionIndex = reactions.indexOf(existingReaction);
          reactions.splice(reactionIndex, 1);
        }
      } else {
        // Add user to existing reaction
        existingReaction.users.push(serverUserId);
        existingReaction.amount = existingReaction.users.length;
      }
    } else {
      // Create new reaction (user can have multiple different reactions)
      reactions.push({
        src: reactionSrc,
        amount: 1,
        users: [serverUserId]
      });
    }
    
    // Update the message with new reactions
    const reactionsJson = reactions.length > 0 ? JSON.stringify(reactions) : null;
    await c.execute(
      `UPDATE messages_by_conversation SET reactions = ? WHERE conversation_id = ? AND created_at = ? AND message_id = ?`,
      [reactionsJson, conversationId, row["created_at"], messageId],
      { prepare: true }
    );
    
    console.log(`✅ Reaction added successfully:`, { messageId, reactionSrc, serverUserId });
    
    // Return updated message
    return {
      conversation_id: row["conversation_id"],
      created_at: row["created_at"],
      message_id: row["message_id"].toString(),
      sender_server_id: row["sender_server_id"],
      text: row["text"],
      attachments: row["attachments"] ?? null,
      reactions: reactions.length > 0 ? reactions : null
    };
  } catch (error) {
    console.error(`❌ Failed to add reaction:`, error);
    throw error;
  }
}

export async function removeReactionFromMessage(
  conversationId: string, 
  messageId: string, 
  reactionSrc: string, 
  serverUserId: string
): Promise<MessageRecord | null> {
  const c = getScyllaClient();
  
  console.log(`👎 Removing reaction from message:`, {
    conversation_id: conversationId,
    message_id: messageId,
    reaction_src: reactionSrc,
    server_user_id: serverUserId
  });
  
  try {
    // First, get the current message to retrieve existing reactions
    const rs = await c.execute(
      `SELECT conversation_id, created_at, message_id, sender_server_id, text, attachments, reactions FROM messages_by_conversation WHERE conversation_id = ? AND message_id = ?`,
      [conversationId, messageId],
      { prepare: true }
    );
    
    const row = rs.first();
    if (!row) {
      console.log(`❌ Message not found:`, { conversationId, messageId });
      return null;
    }
    
    // Parse existing reactions
    let reactions: Reaction[] = row["reactions"] ? JSON.parse(row["reactions"]) : [];
    
    // Find existing reaction with the same src
    const existingReactionIndex = reactions.findIndex(r => r.src === reactionSrc);
    
    if (existingReactionIndex === -1) {
      console.log(`⚠️ Reaction not found:`, { reactionSrc });
      return null; // Reaction doesn't exist, no change needed
    }
    
    const existingReaction = reactions[existingReactionIndex];
    
    // Check if user reacted with this image
    const userIndex = existingReaction.users.indexOf(serverUserId);
    if (userIndex === -1) {
      console.log(`⚠️ User didn't react with this image:`, { serverUserId, reactionSrc });
      return null; // User didn't react, no change needed
    }
    
    // Remove user from reaction
    existingReaction.users.splice(userIndex, 1);
    existingReaction.amount = existingReaction.users.length;
    
    // If no users left, remove the entire reaction
    if (existingReaction.amount === 0) {
      reactions.splice(existingReactionIndex, 1);
    }
    
    // Update the message with new reactions
    const reactionsJson = reactions.length > 0 ? JSON.stringify(reactions) : null;
    await c.execute(
      `UPDATE messages_by_conversation SET reactions = ? WHERE conversation_id = ? AND created_at = ? AND message_id = ?`,
      [reactionsJson, conversationId, row["created_at"], messageId],
      { prepare: true }
    );
    
    console.log(`✅ Reaction removed successfully:`, { messageId, reactionSrc, serverUserId });
    
    // Return updated message
    return {
      conversation_id: row["conversation_id"],
      created_at: row["created_at"],
      message_id: row["message_id"].toString(),
      sender_server_id: row["sender_server_id"],
      text: row["text"],
      attachments: row["attachments"] ?? null,
      reactions: reactions.length > 0 ? reactions : null
    };
  } catch (error) {
    console.error(`❌ Failed to remove reaction:`, error);
    throw error;
  }
} 