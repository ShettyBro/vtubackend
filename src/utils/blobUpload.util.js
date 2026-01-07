/**
 * Blob Upload Utility Module
 * 
 * Handles document uploads to Azure Blob Storage.
 * Implements the standardized blob path structure for VTU Fest documents.
 * 
 * Blob Path Pattern: /colleges/{college_code}/{usn}/application/{docType}.{ext}
 * 
 * Railway Deployment Notes:
 * - Requires AZURE_STORAGE_CONNECTION_STRING in environment
 * - Container created automatically if it doesn't exist
 * - Max file size enforced: 5MB
 */

const { getBlobServiceClient, getBlobContainer } = require('../config/blob');
const path = require('path');

// Maximum file size: 5MB (in bytes)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed document types
const ALLOWED_DOC_TYPES = ['AADHAR', 'SSLC', 'COLLEGE_ID'];

// Allowed file extensions (case-insensitive)
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];

/**
 * Upload a document to Azure Blob Storage
 * 
 * @param {Object} file - File object from multer middleware
 * @param {Buffer} file.buffer - File content as buffer
 * @param {string} file.originalname - Original filename with extension
 * @param {string} file.mimetype - MIME type of the file
 * @param {number} file.size - File size in bytes
 * @param {string} college_code - College code (e.g., 'RVCE', 'BMSCE')
 * @param {string} usn - University Seat Number (e.g., '1AB21CS001')
 * @param {string} docType - Document type ('AADHAR', 'SSLC', or 'COLLEGE_ID')
 * @returns {Promise<string>} Public URL of the uploaded blob
 * @throws {Error} If validation fails or upload fails
 */
async function uploadDocument(file, college_code, usn, docType) {
  // Validate inputs
  if (!file || !file.buffer) {
    throw new Error('No file provided or file buffer is empty');
  }

  if (!college_code || typeof college_code !== 'string') {
    throw new Error('College code is required');
  }

  if (!usn || typeof usn !== 'string') {
    throw new Error('USN is required');
  }

  if (!docType || !ALLOWED_DOC_TYPES.includes(docType)) {
    throw new Error(`Invalid document type. Allowed types: ${ALLOWED_DOC_TYPES.join(', ')}`);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    throw new Error(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
  }

  // Extract and validate file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (!fileExtension) {
    throw new Error('File must have a valid extension');
  }

  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  // Sanitize inputs to prevent path traversal attacks
  const sanitizedCollegeCode = college_code.replace(/[^a-zA-Z0-9]/g, '');
  const sanitizedUsn = usn.replace(/[^a-zA-Z0-9]/g, '');
  const sanitizedDocType = docType.toUpperCase();

  // Construct blob path: /colleges/{college_code}/{usn}/application/{docType}.{ext}
  const blobName = `colleges/${sanitizedCollegeCode}/${sanitizedUsn}/application/${sanitizedDocType}${fileExtension}`;

  try {
    // Get blob container reference
    const containerClient = getBlobContainer();

    // Get block blob client for the specific blob
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload options
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: file.mimetype
      },
      metadata: {
        college_code: sanitizedCollegeCode,
        usn: sanitizedUsn,
        document_type: sanitizedDocType,
        original_filename: file.originalname,
        uploaded_at: new Date().toISOString()
      }
    };

    // Upload the file buffer to Azure Blob Storage
    await blockBlobClient.uploadData(file.buffer, uploadOptions);

    // Return the public URL of the uploaded blob
    const blobUrl = blockBlobClient.url;

    console.log(`Successfully uploaded ${docType} for ${usn} to ${blobName}`);

    return blobUrl;
  } catch (error) {
    console.error('Error uploading document to Azure Blob Storage:', error.message);

    // Provide helpful error messages
    if (error.code === 'ContainerNotFound') {
      throw new Error('Storage container not found. Please contact administrator.');
    } else if (error.code === 'InvalidAuthenticationInfo') {
      throw new Error('Storage authentication failed. Please contact administrator.');
    } else {
      throw new Error('Failed to upload document. Please try again.');
    }
  }
}

/**
 * Delete a document from Azure Blob Storage
 * 
 * @param {string} blobUrl - Full URL of the blob to delete
 * @returns {Promise<boolean>} True if deletion successful
 * @throws {Error} If deletion fails
 */
async function deleteDocument(blobUrl) {
  if (!blobUrl || typeof blobUrl !== 'string') {
    throw new Error('Blob URL is required');
  }

  try {
    // Extract blob name from URL
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/');
    // Remove container name (first part) to get blob name
    const blobName = pathParts.slice(2).join('/');

    const containerClient = getBlobContainer();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Delete the blob
    await blockBlobClient.deleteIfExists();

    console.log(`Successfully deleted blob: ${blobName}`);
    return true;
  } catch (error) {
    console.error('Error deleting document from Azure Blob Storage:', error.message);
    throw new Error('Failed to delete document');
  }
}

module.exports = {
  uploadDocument,
  deleteDocument
};