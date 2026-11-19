const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Initialize Redis connection
 */
async function initializeRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server refused connection');
          return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    logger.info('Redis connection established successfully');
    
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 * @returns {RedisClient} Redis client
 */
function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

/**
 * Store post data in Redis
 * @param {string} postId - Post identifier
 * @param {object} postData - Post data to store
 */
async function storePost(postId, postData) {
  try {
    const client = getRedisClient();
    const postKey = `halo:post:${postId}`;
    
    // Store each field individually
    const postDataWithTimestamp = {
      ...postData,
      createdAt: new Date().toISOString()
    };
    
    // Store each field individually (skip null/undefined; coerce to string)
    for (const [key, value] of Object.entries(postDataWithTimestamp)) {
      if (value === null || value === undefined) {
        continue;
      }
      await client.hSet(postKey, key, String(value));
    }
    // Ensure numeric counters exist for top-level posts
    const isTopLevel = (!postData.parentSequentialCode || String(postData.parentSequentialCode).length === 0) && (!postData.parentIpfsHash || String(postData.parentIpfsHash).length === 0);
    if (isTopLevel) {
      const hasReplies = await client.hGet(postKey, 'repliesCount');
      if (hasReplies === null) {
        await client.hSet(postKey, 'repliesCount', '0');
      }
      const hasLikes = await client.hGet(postKey, 'likesCount');
      if (hasLikes === null) {
        await client.hSet(postKey, 'likesCount', '0');
      }
    }
    
    // Add to chronological feed ONLY for top-level posts (no parent)
    if (isTopLevel) {
      await client.zAdd('halo:feed:chronological', { score: postData.timestamp, value: postId });
    }
    
    // Add to user's posts
    if (postData.userAddress) {
      await client.zAdd(`halo:user:${postData.userAddress}:posts`, { score: postData.timestamp, value: postId });
    }

    // Index replies by parent to support fetching comment threads
    if (postData.parentSequentialCode && postData.parentSequentialCode.length > 0) {
      const key = `halo:replies:parent:${postData.parentSequentialCode}`;
      await client.zAdd(key, { score: postData.timestamp, value: postId });
      // Increment parent's repliesCount
      const parentKey = `halo:post:${postData.parentSequentialCode}`;
      await client.hIncrBy(parentKey, 'repliesCount', 1);
    }
    if (postData.parentIpfsHash && postData.parentIpfsHash.length > 0) {
      const key = `halo:replies:parentipfs:${postData.parentIpfsHash}`;
      await client.zAdd(key, { score: postData.timestamp, value: postId });
      const parentKey = `halo:post:${postData.parentIpfsHash}`;
      await client.hIncrBy(parentKey, 'repliesCount', 1);
    }
    
    logger.info('Post stored in Redis', { postId, userAddress: postData.userAddress?.slice(0, 10) + '...' });
    
  } catch (error) {
    logger.error('Failed to store post in Redis', error);
    throw error;
  }
}

/**
 * Get post data from Redis
 * @param {string} postId - Post identifier
 * @returns {object|null} Post data or null if not found
 */
async function getPost(postId) {
  try {
    const client = getRedisClient();
    const postKey = `halo:post:${postId}`;
    
    const postData = await client.hGetAll(postKey);
    return Object.keys(postData).length > 0 ? postData : null;
    
  } catch (error) {
    logger.error('Failed to get post from Redis', error);
    return null;
  }
}

/**
 * Get chronological feed
 * @param {number} start - Start index
 * @param {number} count - Number of posts to retrieve
 * @returns {Array} Array of post IDs in chronological order
 */
async function getChronologicalFeed(start = 0, count = 50) {
  try {
    const client = getRedisClient();
    
    // Get post IDs in reverse chronological order (newest first)
    let postIds = [];
    try {
      postIds = await client.zRange('halo:feed:chronological', start, start + count - 1, { REV: true });
    } catch (e) {
      if (typeof client.zRevRange === 'function') {
        postIds = await client.zRevRange('halo:feed:chronological', start, start + count - 1);
      } else {
        const forward = await client.zRange('halo:feed:chronological', 0, start + count - 1);
        postIds = forward.slice(start).reverse();
      }
    }
    
    // Get full post data for each ID and FILTER OUT replies defensively
    const posts = [];
    for (const postId of postIds) {
      const postData = await getPost(postId);
      if (!postData) continue;
      const hasParent = (postData.parentSequentialCode && postData.parentSequentialCode.length > 0) || (postData.parentIpfsHash && postData.parentIpfsHash.length > 0);
      if (hasParent) continue;
      posts.push(postData);
    }
    
    return posts;
    
  } catch (error) {
    logger.error('Failed to get chronological feed', error);
    return [];
  }
}

/**
 * Get posts for a specific user
 * @param {string} userAddress - TLS address
 * @param {number} start - Start index
 * @param {number} count - Number of posts to retrieve
 * @returns {Array} Array of post objects for the user
 */
async function getUserPosts(userAddress, start = 0, count = 50) {
  try {
    const client = getRedisClient();
    const key = `halo:user:${userAddress}:posts`;
    let postIds = [];
    try {
      postIds = await client.zRange(key, start, start + count - 1, { REV: true });
    } catch (e) {
      if (typeof client.zRevRange === 'function') {
        postIds = await client.zRevRange(key, start, start + count - 1);
      } else {
        const forward = await client.zRange(key, 0, start + count - 1);
        postIds = forward.slice(start).reverse();
      }
    }
    const posts = [];
    for (const postId of postIds) {
      const postData = await getPost(postId);
      if (postData) posts.push(postData);
    }
    return posts;
  } catch (error) {
    logger.error('Failed to get user posts', error);
    return [];
  }
}

/**
 * Store sequential code metadata
 * @param {string} sequentialCode - Sequential code
 * @param {object} metadata - Code metadata
 */
async function storeSequentialCode(sequentialCode, metadata) {
  try {
    const client = getRedisClient();
    const codeKey = `halo:code:${sequentialCode}`;
    
    // Store each field individually
    const metadataWithTimestamp = {
      ...metadata,
      createdAt: new Date().toISOString()
    };
    
    // Store each field individually
    for (const [key, value] of Object.entries(metadataWithTimestamp)) {
      await client.hSet(codeKey, key, value);
    }
    
    // Add to chronological index
    await client.zAdd('halo:codes:chronological', { score: metadata.timestamp, value: sequentialCode });
    
    logger.info('Sequential code stored', { sequentialCode });
    
  } catch (error) {
    logger.error('Failed to store sequential code', error);
    throw error;
  }
}

/**
 * Get sequential code metadata
 * @param {string} sequentialCode - Sequential code
 * @returns {object|null} Code metadata or null if not found
 */
async function getSequentialCode(sequentialCode) {
  try {
    const client = getRedisClient();
    const codeKey = `halo:code:${sequentialCode}`;
    
    const metadata = await client.hGetAll(codeKey);
    return Object.keys(metadata).length > 0 ? metadata : null;
    
  } catch (error) {
    logger.error('Failed to get sequential code', error);
    return null;
  }
}

/**
 * Rate limiting helper
 * @param {string} key - Rate limit key
 * @param {number} window - Time window in seconds
 * @param {number} limit - Maximum requests per window
 * @returns {boolean} True if within rate limit
 */
async function checkRateLimit(key, window, limit) {
  try {
    const client = getRedisClient();
    const rateLimitKey = `halo:rate_limit:${key}`;
    
    const current = await client.get(rateLimitKey);
    const count = current ? parseInt(current) : 0;
    
    if (count >= limit) {
      return false;
    }
    
    await client.incr(rateLimitKey);
    await client.expire(rateLimitKey, window);
    
    return true;
    
  } catch (error) {
    logger.error('Rate limit check failed', error);
    return true; // Allow if rate limiting fails
  }
}

/**
 * Clean up Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}

/**
 * Delete Halo account data for a wallet address.
 * Removes indexed posts, that user's post index, auth challenges, and writes a deletion record.
 * On-chain transactions are not touched.
 */
async function deleteAccountData(address) {
  const client = getRedisClient();
  const userKey = `halo:user:${address}:posts`;
  let postIds = [];
  try {
    postIds = await client.zRange(userKey, 0, -1);
  } catch (error) {
    logger.error('Failed to list user posts for deletion', error);
    postIds = [];
  }

  let deletedPosts = 0;
  for (const postId of postIds) {
    const post = await getPost(postId);
    try {
      await client.zRem('halo:feed:chronological', postId);
    } catch (error) {
      logger.warn('Feed removal failed during account deletion', { postId });
    }
    if (post && post.parentSequentialCode) {
      try { await client.zRem(`halo:replies:parent:${post.parentSequentialCode}`, postId); } catch (_) {}
    }
    if (post && post.parentIpfsHash) {
      try { await client.zRem(`halo:replies:parentipfs:${post.parentIpfsHash}`, postId); } catch (_) {}
    }
    await client.del(`halo:post:${postId}`);
    await client.del(`halo:code:${postId}`);
    deletedPosts += 1;
  }
  await client.del(userKey);

  let deletedChallenges = 0;
  const match = `halo:auth:challenge:${address}:*`;
  if (typeof client.scanIterator === 'function') {
    for await (const key of client.scanIterator({ MATCH: match, COUNT: 100 })) {
      await client.del(key);
      deletedChallenges += 1;
    }
  }

  const deletedAt = new Date().toISOString();
  await client.set(`halo:account:deleted:${address}`, deletedAt);
  logger.info('Deleted Halo account data', {
    address: address.slice(0, 10) + '...',
    deletedPosts,
    deletedChallenges
  });
  return { deletedPosts, deletedChallenges, deletedAt };
}

module.exports = {
  initializeRedis,
  getRedisClient,
  storePost,
  getPost,
  getChronologicalFeed,
  getUserPosts,
  storeSequentialCode,
  getSequentialCode,
  checkRateLimit,
  deleteAccountData,
  closeRedis
}; 