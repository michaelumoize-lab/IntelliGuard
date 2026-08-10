import ImageKit from "imagekit";

export interface ImageKitUploadResult {
  url: string;
  fileId: string;
  filePath: string;
}

let imagekitInstance: ImageKit | null = null;

function getImageKitClient(): ImageKit {
  if (imagekitInstance) return imagekitInstance;

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error(
      "Missing ImageKit credentials. Ensure IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT environment variables are configured."
    );
  }

  imagekitInstance = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint,
  });

  return imagekitInstance;
}

/**
 * Upload a face image buffer to ImageKit cloud storage under /intelliguard/persons/.
 */
export async function uploadFaceImage(
  imageBuffer: Buffer,
  fileName: string
): Promise<ImageKitUploadResult> {
  const client = getImageKitClient();

  const response = await client.upload({
    file: imageBuffer,
    fileName: fileName || `face_${Date.now()}.jpg`,
    folder: "/intelliguard/persons/",
    useUniqueFileName: true,
    isPrivateFile: true, // Biometric images stored as private files
  });

  // Generate signed, short-lived delivery URL for secure admin dashboard rendering
  const signedUrl = client.url({
    path: response.filePath,
    signed: true,
    expireSeconds: 3600 * 24, // 24 hours expiry
  });

  return {
    url: signedUrl,
    fileId: response.fileId,
    filePath: response.filePath,
  };
}

/**
 * Delete an uploaded face image from ImageKit by fileId (used for transactional cleanup).
 */
export async function deleteFaceImage(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const client = getImageKitClient();
    await client.deleteFile(fileId);
    return true;
  } catch (error) {
    console.error(`Failed to delete ImageKit asset (fileId: ${fileId}):`, error);
    return false;
  }
}
