import { BlobServiceClient } from "@azure/storage-blob";
import env from "./env.js";

let containerClient = null;

export function getBlobContainer() {
  if (containerClient) return containerClient;

  if (!env.blob.connectionString || !env.blob.container) {
    throw new Error("Blob storage not configured");
  }

  const serviceClient = BlobServiceClient.fromConnectionString(
    env.blob.connectionString
  );

  containerClient = serviceClient.getContainerClient(env.blob.container);
  return containerClient;
}
