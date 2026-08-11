import fs from 'fs';
import path from 'path';

/**
 * Recursively retrieves all JavaScript/TypeScript file paths within a directory.
 */
export function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getFilesRecursively(filePath, fileList);
    } else if (
      (file.endsWith('.ts') || file.endsWith('.js')) &&
      !file.endsWith('.d.ts')
    ) {
      fileList.push(filePath);
    }
  }

  return fileList;
}
