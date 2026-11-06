/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const GOOGLE_DRIVE_PARENT_FOLDER_ID = '1DJCFlItKnPr4-YGShTwmJEgiFQ8Yayqc';
export const GOOGLE_DRIVE_PARENT_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_PARENT_FOLDER_ID}?usp=sharing`;

export interface DriveFolderInfo {
  folderId: string;
  folderName: string;
  folderUrl: string;
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink: string;
  directImageUrl: string;
  thumbnailLink?: string;
}

/**
 * Clean student full name to folder format
 */
export function formatStudentFolderName(fullName: string, studentId: string): string {
  const safeName = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_');
  return `FitTrack_${safeName}_${studentId}`;
}

/**
 * Searches for an existing folder or creates a new one inside the parent Drive folder
 */
export async function findOrCreateStudentFolder(
  accessToken: string,
  fullName: string,
  studentId: string
): Promise<DriveFolderInfo> {
  const folderName = formatStudentFolderName(fullName, studentId);

  // 1. Check if folder already exists inside parent
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${GOOGLE_DRIVE_PARENT_FOLDER_ID}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      const existing = data.files[0];
      return {
        folderId: existing.id,
        folderName: existing.name,
        folderUrl: `https://drive.google.com/drive/folders/${existing.id}`,
      };
    }
  }

  // 2. Folder does not exist, create it
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [GOOGLE_DRIVE_PARENT_FOLDER_ID],
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Không thể tạo thư mục trên Google Drive');
  }

  const created = await createRes.json();

  // Set reader permission so anyone with the link can view the folder
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${created.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch {
    // Ignore permission error if restricted
  }

  return {
    folderId: created.id,
    folderName,
    folderUrl: `https://drive.google.com/drive/folders/${created.id}`,
  };
}

/**
 * Upload a meal photo to Google Drive inside a specific folder
 */
export async function uploadMealPhotoToDrive(
  accessToken: string,
  folderId: string,
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<DriveUploadResult> {
  // Strip data URL scheme if present
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '').trim();
  
  // Convert base64 to binary byte array
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const fileBlob = new Blob([bytes], { type: mimeType });

  // Multipart upload to Google Drive
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', fileBlob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const errData = await uploadRes.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Không thể tải ảnh lên Google Drive');
  }

  const uploaded = await uploadRes.json();

  // Set public read permission on the file so the image URL can be loaded directly in <img> tags without bloating DB
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch {
    // Ignore permission errors if domain restricted
  }

  // Direct embeddable Google Drive image URL (zero Base64 storage in DB)
  const directImageUrl = `https://lh3.googleusercontent.com/d/${uploaded.id}=w1000`;

  return {
    fileId: uploaded.id,
    fileName: uploaded.name,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    directImageUrl,
    thumbnailLink: uploaded.thumbnailLink,
  };
}

export interface DrivePhotoItem {
  id: string;
  name: string;
  directImageUrl: string;
  webViewLink: string;
  createdTime?: string;
}

/**
 * Fetch meal photo links directly from the student's folder on Google Drive
 * (inside parent folder 1DJCFlItKnPr4-YGShTwmJEgiFQ8Yayqc) without storing or syncing to DB
 */
export async function listStudentDrivePhotos(
  accessToken: string,
  fullName: string,
  studentId: string
): Promise<{ folder: DriveFolderInfo; photos: DrivePhotoItem[] }> {
  const folder = await findOrCreateStudentFolder(accessToken, fullName, studentId);

  const q = `'${folder.folderId}' in parents and mimeType contains 'image/' and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&orderBy=createdTime desc&pageSize=30&fields=files(id,name,webViewLink,thumbnailLink,createdTime)`;

  const res = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    return { folder, photos: [] };
  }

  const data = await res.json();
  const files = Array.isArray(data.files) ? data.files : [];

  const photos: DrivePhotoItem[] = files.map((f: any) => ({
    id: f.id,
    name: f.name,
    directImageUrl: `https://lh3.googleusercontent.com/d/${f.id}=w1000`,
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    createdTime: f.createdTime,
  }));

  return { folder, photos };
}

/**
 * Batch create folders for all students
 */
export async function createFoldersForAllStudents(
  accessToken: string,
  students: Array<{ id: string; fullName: string }>
): Promise<Array<{ studentId: string; folderId: string; folderUrl: string }>> {
  const results: Array<{ studentId: string; folderId: string; folderUrl: string }> = [];
  for (const s of students) {
    try {
      const folder = await findOrCreateStudentFolder(accessToken, s.fullName, s.id);
      results.push({
        studentId: s.id,
        folderId: folder.folderId,
        folderUrl: folder.folderUrl,
      });
    } catch (err) {
      console.warn(`Could not create folder for student ${s.fullName}:`, err);
    }
  }
  return results;
}

const CLOUD_DB_FILENAME = 'fittrack_cloud_database.json';

/**
 * Saves the system database snapshot (students, users, metrics, advices, meals, workouts)
 * to a lightweight JSON file inside the trainer's Google Drive parent folder so static
 * deployments (like GitHub Pages) can persist and share database state across devices.
 */
export async function saveCloudDatabaseToDrive(
  accessToken: string,
  payload: Record<string, any>
): Promise<boolean> {
  try {
    const q = `name = '${CLOUD_DB_FILENAME}' and '${GOOGLE_DRIVE_PARENT_FOLDER_ID}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingFileId: string | null = null;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData.files) && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }

    const jsonBlob = new Blob([JSON.stringify({ ...payload, updatedAt: Date.now() }, null, 2)], {
      type: 'application/json',
    });

    if (existingFileId) {
      const updateRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: jsonBlob,
        }
      );
      return updateRes.ok;
    } else {
      const metadata = {
        name: CLOUD_DB_FILENAME,
        mimeType: 'application/json',
        parents: [GOOGLE_DRIVE_PARENT_FOLDER_ID],
      };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', jsonBlob);

      const createRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        }
      );
      return createRes.ok;
    }
  } catch (err) {
    console.warn('Could not sync database snapshot to Google Drive:', err);
    return false;
  }
}

/**
 * Loads the system database snapshot from the trainer's Google Drive parent folder if present.
 */
export async function loadCloudDatabaseFromDrive(
  accessToken: string
): Promise<Record<string, any> | null> {
  try {
    const q = `name = '${CLOUD_DB_FILENAME}' and '${GOOGLE_DRIVE_PARENT_FOLDER_ID}' in parents and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    if (!Array.isArray(searchData.files) || searchData.files.length === 0) {
      return null;
    }

    const fileId = searchData.files[0].id;
    const downloadRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!downloadRes.ok) return null;
    return await downloadRes.json();
  } catch (err) {
    console.warn('Could not load database snapshot from Google Drive:', err);
    return null;
  }
}


