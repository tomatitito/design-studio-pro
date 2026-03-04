export interface Asset {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  fileSize: number;
  mimeType: string;
  dimensions: { width: number; height: number } | null;
  createdAt: string;
}
