import fs from 'node:fs';
import path from 'node:path';

export type UserGender = 'male' | 'female' | null | undefined;

export interface InteractionResolutionOptions {
  action: string;
  initiatorGender?: UserGender;
  targetGender?: UserGender;
  basePicturesDir?: string;
}

export interface ResolvedInteractionAsset {
  absolutePath: string;
  relativePath: string;
  category: 'het' | 'yuri' | 'yaoi';
  subCategory?: 'female_initiated' | 'male_initiated' | 'mutual';
  fileName: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.gif', '.png', '.jpg', '.jpeg', '.webp']);

/**
 * Resolves the eligible relative directory paths for an interaction based on genders.
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
export function getEligibleInteractionDirectories(
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
 * Resolves a random image/GIF asset for an interaction matching gender rules.
 */
export function resolveInteractionAsset(
  options: InteractionResolutionOptions
): ResolvedInteractionAsset | null {
  const baseDir = options.basePicturesDir ?? path.resolve(process.cwd(), 'Pictures/interactions');
  const eligibleDirs = getEligibleInteractionDirectories(
    options.action,
    options.initiatorGender,
    options.targetGender
  );

  const availableFiles: { fullPath: string; dir: string; file: string }[] = [];

  for (const subDir of eligibleDirs) {
    // subDir has format "${action}/sub/path"
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
          availableFiles.push({
            fullPath: path.join(fullDirPath, file),
            dir: relativeSubPath,
            file,
          });
        }
      }
    } catch {
      // Directory unreadable
    }
  }

  if (availableFiles.length === 0) {
    return null;
  }

  const chosen = availableFiles[Math.floor(Math.random() * availableFiles.length)];
  let category: 'het' | 'yuri' | 'yaoi' = 'het';
  let subCategory: 'female_initiated' | 'male_initiated' | 'mutual' | undefined;

  if (chosen.dir.startsWith('yuri')) {
    category = 'yuri';
  } else if (chosen.dir.startsWith('yaoi')) {
    category = 'yaoi';
  } else {
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
