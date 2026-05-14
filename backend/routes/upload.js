const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
  }
});

// Since the user requested AWS S3 but didn't provide credentials, we will provide an endpoint that
// either generates a presigned URL or uses multer-s3.
// For simplicity and security, generating a presigned URL is best.
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

router.post('/presigned-url', authMiddleware, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType) {
      return res.status(400).json({ message: 'Filename and contentType are required' });
    }

    const uniqueFilename = `${req.user.id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME || 'roomfind-bucket',
      Key: uniqueFilename,
      ContentType: contentType,
      // ACL: 'public-read' // Only if bucket supports ACLs
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Construct the final public URL
    const bucketRegion = process.env.AWS_REGION || 'us-east-1';
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'roomfind-bucket';
    const publicUrl = `https://${bucketName}.s3.${bucketRegion}.amazonaws.com/${uniqueFilename}`;

    res.json({ presignedUrl, publicUrl, key: uniqueFilename });
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.status(500).json({ message: 'Server error generating upload URL' });
  }
});

module.exports = router;
