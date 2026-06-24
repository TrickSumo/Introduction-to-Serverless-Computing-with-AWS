# Introduction to Serverless Computing with AWS

Build a real serverless app step by step. Create a resume site that grows from a static page into a
multi-tenant product. Each module adds one AWS service, introduced **because the last step needs it**.

| # | Module | Adds | Services |
|---|--------|------|----------|
| 01 | Make Static Website Online | Site live on a real URL | S3, CloudFront |
| 02 | Views Counter | A real backend + saved state | Lambda, DynamoDB, API Gateway |
| 03 | Secure The Resume | Lock content behind a private link | CloudFront signed cookies (RSA) |
| 04 | Live Counter | Real-time updates pushed to viewers | WebSocket API, DynamoDB Streams |
| 05 | Management Dashboard | Sign-up so every user gets their own private resume | Cognito (multi-tenant), presigned S3 uploads |

**Progression:** static → dynamic → secured → real-time → multi-tenant.

Stack: HTML + JS + Node.js, built in the AWS Console (no local setup). Modules 01–04 are the core
course; 05 is the advanced "multi-tenant" extension.
