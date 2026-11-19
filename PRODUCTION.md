# Production Halo is not this snapshot

`https://halo.telestai.io` is served by the `halo-indexer` container on Optimus (`127.0.0.1:3001`), source directory `/home/chief/halo-indexer-app`. That tree is not this GitHub repository.

Production challenges are in-memory. Its challenge error is `address and bundleId are required`. This repository uses Redis challenges and Joi validation. Do not deploy this repository over the Optimus tree.

The live account-deletion behaviour (posts and messages kept, author shown as `deleted user - <name>` plus the TLS address, profile and sessions removed) was applied on the Optimus source on 19 Nov 2026. Backup: `/home/chief/backups/halo-indexer-app-20261119-092059` (source plus Redis `dump.rdb`).

Support pages on that server: `https://halo.telestai.io/support` and `https://halo.telestai.io/faq`.
