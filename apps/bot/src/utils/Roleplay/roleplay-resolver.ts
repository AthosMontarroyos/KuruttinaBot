import fs from 'node:fs';
import path from 'node:path';

export type UserGender = 'male' | 'female' | null | undefined;

export interface RoleplayResolutionOptions {
  action: string;
  initiatorGender?: UserGender;
  targetGender?: UserGender;
  basePicturesDir?: string;
  ignoreGender?: boolean;
}

export interface ResolvedRoleplayAsset {
  absolutePath: string;
  relativePath: string;
  category: 'het' | 'yuri' | 'yaoi' | 'general';
  subCategory?: 'female_initiated' | 'male_initiated' | 'mutual';
  fileName: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.gif', '.png', '.jpg', '.jpeg', '.webp']);

/**
 * Resolves the eligible relative directory paths for a roleplay action based on genders.
 * 
 * Rules:
 * 1. Both undefined: picks randomly from all folders (het, yuri, yaoi).
 * 2. Male initiator + Female target: het/male_initiated or het/mutual.
 * 3. Female initiator + Male target: het/female_initiated or het/mutual.
 * 4. Female + Female: yuri.
 * 5. Male + Male: yaoi.
 * 6. Male initiator + undefined target: het (male_initiated/mutual) OR yaoi.
 * 7. Female initiator + undefined target: het (female_initiated/mutual) OR yuri.
 * 8. Undefined initiator + Male target: het (female_initiated/mutual) OR yaoi.
 * 9. Undefined initiator + Female target: het (male_initiated/mutual) OR yuri.
 */
export function getEligibleRoleplayDirectories(
  action: string,
  initiatorGender?: UserGender,
  targetGender?: UserGender
): string[] {
  const normInit = initiatorGender?.toLowerCase() as 'male' | 'female' | undefined;
  const normTarget = targetGender?.toLowerCase() as 'male' | 'female' | undefined;

  const hetMale = `${action}/het/male_initiated`;
  const hetFemale = `${action}/het/female_initiated`;
  const hetMutual = `${action}/het/mutual`;
  const yuri = `${action}/yuri`;
  const yaoi = `${action}/yaoi`;

  // Both undefined
  if (!normInit && !normTarget) {
    return [hetMale, hetFemale, hetMutual, yuri, yaoi];
  }

  // Male Initiator
  if (normInit === 'male') {
    if (normTarget === 'female') {
      return [hetMale, hetMutual];
    }
    if (normTarget === 'male') {
      return [yaoi];
    }
    // Target undefined: random het (male) or yaoi
    return [hetMale, hetMutual, yaoi];
  }

  // Female Initiator
  if (normInit === 'female') {
    if (normTarget === 'male') {
      return [hetFemale, hetMutual];
    }
    if (normTarget === 'female') {
      return [yuri];
    }
    // Target undefined: random het (female) or yuri
    return [hetFemale, hetMutual, yuri];
  }

  // Initiator undefined, Target defined
  if (normTarget === 'male') {
    return [hetFemale, hetMutual, yaoi];
  }

  if (normTarget === 'female') {
    return [hetMale, hetMutual, yuri];
  }

  return [hetMale, hetFemale, hetMutual, yuri, yaoi];
}

/**
 * Resolves a random image/GIF asset for a roleplay action matching gender rules or genderless root GIFs.
 */
export function resolveRoleplayAsset(
  options: RoleplayResolutionOptions
): ResolvedRoleplayAsset | null {
  const baseDir = options.basePicturesDir ?? path.resolve(process.cwd(), 'Pictures/Roleplay');
  const availableFiles: { fullPath: string; dir: string; file: string }[] = [];

  // Check root action directory (e.g. Pictures/Roleplay/dance) for direct root files
  const rootDirPath = path.join(baseDir, options.action);
  if (fs.existsSync(rootDirPath)) {
    try {
      const files = fs.readdirSync(rootDirPath);
      for (const file of files) {
        if (file.startsWith('.')) continue;
        const ext = path.extname(file).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          const stat = fs.statSync(path.join(rootDirPath, file));
          if (stat.isFile()) {
            availableFiles.push({
              fullPath: path.join(rootDirPath, file),
              dir: '',
              file,
            });
          }
        }
      }
    } catch {
      // Directory unreadable
    }
  }

  // Scan gender subdirectories unless ignoreGender is explicitly set to true
  if (!options.ignoreGender) {
    const eligibleDirs = getEligibleRoleplayDirectories(
      options.action,
      options.initiatorGender,
      options.targetGender
    );

    for (const subDir of eligibleDirs) {
      const relativeSubPath = subDir.startsWith(`${options.action}/`)
        ? subDir.slice(options.action.length + 1)
        : subDir;

      const fullDirPath = path.join(baseDir, options.action, relativeSubPath);
      if (!fs.existsSync(fullDirPath)) continue;

      try {
        const files = fs.readdirSync(fullDirPath);
        for (const file of files) {
          if (file.startsWith('.')) continue;
          const ext = path.extname(file).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            const stat = fs.statSync(path.join(fullDirPath, file));
            if (stat.isFile()) {
              availableFiles.push({
                fullPath: path.join(fullDirPath, file),
                dir: relativeSubPath,
                file,
              });
            }
          }
        }
      } catch {
        // Directory unreadable
      }
    }
  }

  if (availableFiles.length === 0) {
    return null;
  }

  const chosen = availableFiles[Math.floor(Math.random() * availableFiles.length)];
  let category: 'het' | 'yuri' | 'yaoi' | 'general' = 'general';
  let subCategory: 'female_initiated' | 'male_initiated' | 'mutual' | undefined;

  if (chosen.dir.startsWith('yuri')) {
    category = 'yuri';
  } else if (chosen.dir.startsWith('yaoi')) {
    category = 'yaoi';
  } else if (chosen.dir.startsWith('het')) {
    category = 'het';
    if (chosen.dir.includes('female_initiated')) subCategory = 'female_initiated';
    else if (chosen.dir.includes('male_initiated')) subCategory = 'male_initiated';
    else if (chosen.dir.includes('mutual')) subCategory = 'mutual';
  }

  return {
    absolutePath: chosen.fullPath,
    relativePath: path.relative(process.cwd(), chosen.fullPath).replace(/\\/g, '/'),
    category,
    subCategory,
    fileName: chosen.file,
  };
}
