const { Client } = require('cassandra-driver');
const logger = require('../utils/logger');

let cassandraClient = null;

/**
 * Initialize Cassandra connection
 */
async function initializeCassandra() {
  try {
    const client = new Client({
      contactPoints: process.env.CASSANDRA_CONTACT_POINTS?.split(',') || ['localhost'],
      localDataCenter: process.env.CASSANDRA_DATACENTER || 'datacenter1',
      keyspace: process.env.CASSANDRA_KEYSPACE || 'halo_indexer',
      credentials: {
        username: process.env.CASSANDRA_USERNAME || 'cassandra',
        password: process.env.CASSANDRA_PASSWORD || 'cassandra'
      },
      pooling: {
        maxRequestsPerConnection: 32768
      }
    });

    await client.connect();
    cassandraClient = client;

    // Create keyspace if it doesn't exist
    await createKeyspace();
    
    // Create tables
    await createTables();

    logger.info('Cassandra client connected successfully');
    return client;
  } catch (error) {
    logger.error('Failed to connect to Cassandra', error);
    throw error;
  }
}

/**
 * Create keyspace if it doesn't exist
 */
async function createKeyspace() {
  try {
    const query = `
      CREATE KEYSPACE IF NOT EXISTS ${process.env.CASSANDRA_KEYSPACE || 'halo_indexer'}
      WITH replication = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `;
    await cassandraClient.execute(query);
    logger.info('Cassandra keyspace created/verified');
  } catch (error) {
    logger.error('Failed to create keyspace', error);
    throw error;
  }
}

/**
 * Create necessary tables
 */
async function createTables() {
  try {
    // Posts table
    const postsTable = `
      CREATE TABLE IF NOT EXISTS posts (
        sequential_code text PRIMARY KEY,
        user_address text,
        content text,
        signature text,
        timestamp bigint,
        ipfs_hash text,
        post_type text,
        live_flag text,
        batch_code text,
        block_height bigint,
        -- Media metadata (not actual files - stored on FluxDrive by users)
        media_urls list<text>,      -- FluxDrive URLs
        media_hashes list<text>,     -- File hashes for verification
        media_types list<text>,      -- MIME types
        media_sizes list<int>,       -- File sizes in bytes
        created_at timestamp,
        updated_at timestamp
      )
    `;

    // Batches table
    const batchesTable = `
      CREATE TABLE IF NOT EXISTS batches (
        batch_code text PRIMARY KEY,
        batch_number int,
        status text,
        post_count int,
        created_at timestamp,
        processed_at timestamp,
        block_height bigint,
        error text
      )
    `;

    // Sequential codes table
    const codesTable = `
      CREATE TABLE IF NOT EXISTS sequential_codes (
        code text PRIMARY KEY,
        user_address text,
        timestamp bigint,
        nonce text,
        uniqueness_hash text,
        created_at timestamp
      )
    `;

    // User posts index
    const userPostsIndex = `
      CREATE TABLE IF NOT EXISTS user_posts (
        user_address text,
        timestamp bigint,
        sequential_code text,
        PRIMARY KEY (user_address, timestamp, sequential_code)
      )
    `;

    // Chronological feed index
    const feedIndex = `
      CREATE TABLE IF NOT EXISTS chronological_feed (
        feed_timestamp bigint,
        sequential_code text,
        PRIMARY KEY (feed_timestamp, sequential_code)
      )
    `;

    await cassandraClient.execute(postsTable);
    await cassandraClient.execute(batchesTable);
    await cassandraClient.execute(codesTable);
    await cassandraClient.execute(userPostsIndex);
    await cassandraClient.execute(feedIndex);

    logger.info('Cassandra tables created/verified');
  } catch (error) {
    logger.error('Failed to create tables', error);
    throw error;
  }
}

/**
 * Get Cassandra client
 */
function getCassandraClient() {
  if (!cassandraClient) {
    throw new Error('Cassandra client not initialized. Call initializeCassandra() first.');
  }
  return cassandraClient;
}

/**
 * Store post in Cassandra
 */
async function storePost(sequentialCode, postData) {
  try {
    const client = getCassandraClient();
    const query = `
      INSERT INTO posts (
        sequential_code, user_address, content, signature, timestamp,
        ipfs_hash, post_type, live_flag, batch_code, block_height,
        media_urls, media_hashes, media_types, media_sizes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      sequentialCode,
      postData.userAddress,
      postData.content,
      postData.signature,
      postData.timestamp,
      postData.ipfsHash || '',
      postData.postType,
      postData.liveFlag,
      postData.batchCode || null,
      postData.blockHeight || null,
      postData.mediaUrls || [],
      postData.mediaHashes || [],
      postData.mediaTypes || [],
      postData.mediaSizes || [],
      new Date(),
      new Date()
    ];

    await client.execute(query, params, { prepare: true });

    // Store in user posts index
    const userPostsQuery = `
      INSERT INTO user_posts (user_address, timestamp, sequential_code)
      VALUES (?, ?, ?)
    `;
    await client.execute(userPostsQuery, [
      postData.userAddress,
      postData.timestamp,
      sequentialCode
    ], { prepare: true });

    // Store in chronological feed index
    const feedQuery = `
      INSERT INTO chronological_feed (feed_timestamp, sequential_code)
      VALUES (?, ?)
    `;
    await client.execute(feedQuery, [
      postData.timestamp,
      sequentialCode
    ], { prepare: true });

    logger.info('Post stored in Cassandra', {
      sequentialCode,
      userAddress: postData.userAddress.slice(0, 10) + '...'
    });
  } catch (error) {
    logger.error('Failed to store post in Cassandra', error);
    throw error;
  }
}

/**
 * Get post from Cassandra
 */
async function getPost(sequentialCode) {
  try {
    const client = getCassandraClient();
    const query = 'SELECT * FROM posts WHERE sequential_code = ?';
    const result = await client.execute(query, [sequentialCode], { prepare: true });
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get post from Cassandra', error);
    return null;
  }
}

/**
 * Get chronological feed from Cassandra
 */
async function getChronologicalFeed(start = 0, count = 50) {
  try {
    const client = getCassandraClient();
    const query = `
      SELECT * FROM chronological_feed 
      ORDER BY feed_timestamp DESC 
      LIMIT ?
    `;
    
    const result = await client.execute(query, [count], { prepare: true });
    
    // Get full post data for each sequential code
    const posts = [];
    for (const row of result.rows) {
      const post = await getPost(row.sequential_code);
      if (post) {
        posts.push(post);
      }
    }
    
    return posts;
  } catch (error) {
    logger.error('Failed to get chronological feed from Cassandra', error);
    return [];
  }
}

/**
 * Store batch in Cassandra
 */
async function storeBatch(batchData) {
  try {
    const client = getCassandraClient();
    const query = `
      INSERT INTO batches (
        batch_code, batch_number, status, post_count,
        created_at, processed_at, block_height, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      batchData.batchCode,
      batchData.batchNumber,
      batchData.status,
      batchData.postCount,
      new Date(batchData.createdAt),
      batchData.processedAt ? new Date(batchData.processedAt) : null,
      batchData.blockHeight || null,
      batchData.error || null
    ];

    await client.execute(query, params, { prepare: true });

    logger.info('Batch stored in Cassandra', {
      batchCode: batchData.batchCode,
      postCount: batchData.postCount
    });
  } catch (error) {
    logger.error('Failed to store batch in Cassandra', error);
    throw error;
  }
}

/**
 * Store sequential code in Cassandra
 */
async function storeSequentialCode(code, metadata) {
  try {
    const client = getCassandraClient();
    const query = `
      INSERT INTO sequential_codes (
        code, user_address, timestamp, nonce, uniqueness_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      code,
      metadata.userAddress,
      metadata.timestamp,
      metadata.nonce,
      metadata.uniquenessHash,
      new Date()
    ];

    await client.execute(query, params, { prepare: true });

    logger.info('Sequential code stored in Cassandra', { code });
  } catch (error) {
    logger.error('Failed to store sequential code in Cassandra', error);
    throw error;
  }
}

/**
 * Close Cassandra connection
 */
async function closeCassandra() {
  if (cassandraClient) {
    await cassandraClient.shutdown();
    logger.info('Cassandra connection closed');
  }
}

function authorLabelForDeletedUser(displayName) {
  const name = String(displayName || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
  return name ? `deleted user - ${name}` : 'deleted user';
}

/**
 * Keep posts and reply threads. Relabel the author and leave user_posts in place.
 * No-ops when Cassandra is not enabled.
 */
async function deleteAccountData(userAddress, displayName) {
  if (!cassandraClient) {
    return { skipped: true, relabeledPosts: 0, postsKept: true };
  }
  const authorLabel = authorLabelForDeletedUser(displayName);
  try {
    await cassandraClient.execute('ALTER TABLE posts ADD author_label text');
  } catch (error) {
    logger.warn('author_label column already present or could not be added');
  }
  try {
    await cassandraClient.execute('ALTER TABLE posts ADD account_deleted boolean');
  } catch (error) {
    logger.warn('account_deleted column already present or could not be added');
  }

  const result = await cassandraClient.execute(
    'SELECT sequential_code, timestamp FROM user_posts WHERE user_address = ?',
    [userAddress],
    { prepare: true }
  );
  let relabeledPosts = 0;
  for (const row of result.rows || []) {
    const code = row.sequential_code;
    if (!code) continue;
    await cassandraClient.execute(
      'UPDATE posts SET author_label = ?, account_deleted = ?, updated_at = ? WHERE sequential_code = ?',
      [authorLabel, true, new Date(), code],
      { prepare: true }
    );
    relabeledPosts += 1;
  }
  logger.info('Relabeled Cassandra posts for deleted account', {
    address: userAddress.slice(0, 10) + '...',
    relabeledPosts,
    authorLabel
  });
  return { skipped: false, relabeledPosts, deletedPosts: 0, postsKept: true, authorLabel };
}

module.exports = {
  initializeCassandra,
  getCassandraClient,
  storePost,
  getPost,
  getChronologicalFeed,
  storeBatch,
  storeSequentialCode,
  deleteAccountData,
  closeCassandra
}; 