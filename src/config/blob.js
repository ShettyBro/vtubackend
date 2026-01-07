/**
 * Azure Blob Storage Configuration Module
 * 
 * CRITICAL: Lazy blob client initialization
 * - Client is NOT created at module load time
 * - Client is created only when first document upload occurs
 * - This allows Railway health checks to pass without Azure credentials
 * 
 * Railway Deployment Notes:
 * - Requires AZURE_STORAGE_CONNECTION_STRING in environment
 * - Container is created automatically if it doesn't exist
 * - Public read access for uploaded documents
 * 
 * FIX: Converted from ESM (import/export) to CommonJS (require/module.exports)
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const config = require('./env');

let blobServiceClient = null;
let containerClient = null;

/**
 * Get or create BlobServiceClient
 * LAZY INITIALIZATION - only connects when first called
 * 
 * @returns {BlobServiceClient} Azure Blob Service Client
 * @throws {Error} If blob storage configuration is missing
 */
function getBlobServiceClient() {
  if (blobServiceClient) {
    return blobServiceClient;
  }

  if (!config.blob.connectionString) {
    throw new Error('Azure Blob Storage configuration is missing. Please set AZURE_STORAGE_CONNECTION_STRING environment variable.');
  }

  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(
      config.blob.connectionString
    );
    console.log('✅ Azure Blob Service Client initialized');
    return blobServiceClient;
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Service Client:', error.message);
    throw new Error('Failed to connect to Azure Blob Storage');
  }
}

/**
 * Get or create container client
 * LAZY INITIALIZATION - only connects when first called
 * Creates container if it doesn't exist
 * 
 * @returns {ContainerClient} Azure Container Client
 * @throws {Error} If container configuration is missing or creation fails
 */
function getBlobContainer() {
  if (containerClient) {
    return containerClient;
  }

  if (!config.blob.containerName) {
    throw new Error('Azure Blob Storage container name is missing. Please set AZURE_STORAGE_CONTAINER environment variable.');
  }

  try {
    const serviceClient = getBlobServiceClient();
    containerClient = serviceClient.getContainerClient(config.blob.containerName);
    
    console.log(`✅ Azure Blob Container Client initialized: ${config.blob.containerName}`);
    
    // Note: Container creation is handled by uploadDocument in blobUpload.util.js
    // We don't create it here to avoid async issues at module load time
    
    return containerClient;
  } catch (error) {
    console.error('❌ Failed to get blob container client:', error.message);
    throw error;
  }
}

module.exports = {
  getBlobServiceClient,
  getBlobContainer
};