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
 * Computes the canonical delivery URL from ImageKit's configured IMAGEKIT_URL_ENDPOINT and relative filePath.
 * Guarantees a single consistent URL strategy across the entire application.
 */
export function getCanonicalDeliveryUrl(filePath: string): string {
  const urlEndpoint = (process.env.IMAGEKIT_URL_ENDPOINT || "").trim();
  const cleanEndpoint = urlEndpoint.replace(/\/+$/, "");
  const cleanPath = (filePath || "").replace(/^\/+/, "");
  return `${cleanEndpoint}/${cleanPath}`;
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
    isPrivateFile: false, // Serve as public asset so browser <img src="..." /> tags load cleanly
  });

  // Use the exact url returned by ImageKit upload response as the single source of truth
  const deliveryUrl = response.url || getCanonicalDeliveryUrl(response.filePath);

  return {
    url: deliveryUrl,
    fileId: response.fileId,
    filePath: response.filePath,
  };
}

/**
 * Fetch file details from ImageKit using fileId to verify asset existence and obtain canonical URL.
 */
export async function getImageFileDetails(
  fileId: string
): Promise<{ fileId: string; url: string; filePath: string } | null> {
  if (!fileId) return null;
  try {
    const client = getImageKitClient();
    const details = await new Promise<any>((resolve, reject) => {
      client.getFileDetails(fileId, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    if (!details || !details.url) return null;
    return {
      fileId: details.fileId,
      url: details.url,
      filePath: details.filePath,
    };
  } catch (error) {
    console.error(`Failed to fetch ImageKit asset details (fileId: ${fileId}):`, error);
    return null;
  }
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

