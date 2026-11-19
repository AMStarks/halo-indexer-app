const express = require('express');
const Joi = require('joi');
const { createChallenge, consumeChallenge, issueAccessToken, verifyTelestaiSignature } = require('../services/auth');
const { deleteAccountData } = require('../services/redis');
const cassandra = require('../services/cassandra');
const logger = require('../utils/logger');

const router = express.Router();

// Schemas
const challengeQuerySchema = Joi.object({
  address: Joi.string().required(),
  bundleId: Joi.string().optional()
});

const verifyBodySchema = Joi.object({
  address: Joi.string().required(),
  nonce: Joi.string().required(),
  signature: Joi.string().required(),
  pubkey: Joi.string().required(),
  bundleId: Joi.string().optional()
});

const deleteBodySchema = verifyBodySchema.keys({
  displayName: Joi.string().max(80).allow('').optional()
});

// GET /api/halo/challenge?address=&bundleId=
router.get('/challenge', async (req, res) => {
  try {
    const { error, value } = challengeQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: 'Validation error', details: error.details[0].message });
    }
    const { address, bundleId } = value;
    const result = await createChallenge(address, bundleId);
    res.json({ success: true, data: { address, ...result } });
  } catch (err) {
    logger.error('Challenge creation failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/halo/verify
router.post('/verify', async (req, res) => {
  try {
    const { error, value } = verifyBodySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation error', details: error.details[0].message });
    }

    const { address, nonce, signature, pubkey, bundleId } = value;

    // Verify Telestai signature against canonical message
    const challengeData = await consumeChallenge(address, nonce);
    if (!challengeData) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }

    // Rebuild canonical strictly from persisted challenge data to avoid drift
    const ttlSec = parseInt(challengeData.ttlSeconds || process.env.HALO_CHALLENGE_TTL || '120', 10);
    const persistedBundleId = challengeData.bundleId || '';
    // If caller supplied bundleId, require it to match persisted value (defense-in-depth)
    if (bundleId && bundleId !== persistedBundleId) {
      return res.status(400).json({ error: 'Bundle mismatch' });
    }
    const canonical = `LASKO|${nonce}|${ttlSec}|${persistedBundleId}`;
    logger.info('Verifying auth', { addr: address.slice(0,10)+"...", nonce, ttlSec, bundleId: persistedBundleId });
    const ok = verifyTelestaiSignature({
      message: canonical,
      signatureBase64: signature,
      pubkeyCompressedHex: pubkey,
      address
    });
    if (!ok) {
      return res.status(400).json({ error: 'Signature verification failed' });
    }

    const { token, expiresSeconds } = issueAccessToken(address, bundleId || challengeData.bundleId);
    res.json({ success: true, token, expiresIn: expiresSeconds });
  } catch (err) {
    logger.error('Verify failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/halo/account/delete
// Same signed challenge as /verify. Keeps posts and reply threads, relabels the
// author as "deleted user - <name>", and removes profile, auth, and contact data.
// Does not move or destroy on-chain coins.
router.post('/account/delete', async (req, res) => {
  try {
    const { error, value } = deleteBodySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: 'Validation error', details: error.details[0].message });
    }

    const { address, nonce, signature, pubkey, bundleId, displayName } = value;
    const challengeData = await consumeChallenge(address, nonce);
    if (!challengeData) {
      return res.status(400).json({ error: 'Invalid or expired challenge' });
    }

    const ttlSec = parseInt(challengeData.ttlSeconds || process.env.HALO_CHALLENGE_TTL || '120', 10);
    const persistedBundleId = challengeData.bundleId || '';
    if (bundleId && bundleId !== persistedBundleId) {
      return res.status(400).json({ error: 'Bundle mismatch' });
    }
    const canonical = `LASKO|${nonce}|${ttlSec}|${persistedBundleId}`;
    const ok = verifyTelestaiSignature({
      message: canonical,
      signatureBase64: signature,
      pubkeyCompressedHex: pubkey,
      address
    });
    if (!ok) {
      return res.status(400).json({ error: 'Signature verification failed' });
    }

    const redisResult = await deleteAccountData(address, displayName);
    let cassandraResult = { skipped: true, relabeledPosts: 0, postsKept: true };
    if (typeof cassandra.deleteAccountData === 'function') {
      try {
        cassandraResult = await cassandra.deleteAccountData(address, displayName);
      } catch (cassandraError) {
        logger.error('Cassandra account deletion failed', cassandraError);
        cassandraResult = { skipped: false, error: 'cassandra_delete_failed', deletedPosts: 0 };
      }
    }

    res.json({
      success: true,
      address,
      deleted: {
        redis: redisResult,
        cassandra: cassandraResult
      }
    });
  } catch (err) {
    logger.error('Account deletion failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /.well-known/jwks.json (placeholder for HS256; switch to RS256 later)
router.get('/.well-known/jwks.json', (_req, res) => {
  // HS256 has no public key; publish placeholder and metadata for now
  res.json({ keys: [] });
});

module.exports = router;


