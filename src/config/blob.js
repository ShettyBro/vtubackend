import { BlobServiceClient } from "@azure/storage-blob";
import env from "./env.js";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER
);

export { containerClient };
