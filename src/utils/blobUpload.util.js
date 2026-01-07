import { containerClient } from "../config/blob.js";

export async function uploadStudentDocument({
  collegeCode,
  usn,
  file,
  filename
}) {
  const blobPath = `colleges/${collegeCode}/${usn}/application/${filename}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobPath);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype
    }
  });

  return blockBlobClient.url;
}
