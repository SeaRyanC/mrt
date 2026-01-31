import fs from 'fs/promises';
import path from 'path';
import { parseFilename, generateNewPath, MediaInfo, VALID_VIDEO_EXTENSIONS } from './parser';
import { parseFilenameWithAI } from './openai-parser';

interface DryModeOptions {
  apiKey: string;
  fs?: string;
  list?: string;
}

/**
 * Common associated file extensions that should "go along for the ride"
 */
const ASSOCIATED_FILE_EXTENSIONS = [
  '.srt', '.sub', '.idx', '.ass', '.ssa', '.vtt',  // Subtitles
  '.nfo',                                           // Info files
  '.jpg', '.jpeg', '.png', '.tbn',                  // Images/thumbnails
  '.txt',                                           // Text files
];

/**
 * Get list of files from filesystem
 */
async function enumerateFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        // Only include video files
        const ext = path.extname(entry.name).toLowerCase();
        if (VALID_VIDEO_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  await walk(dirPath);
  return files;
}

/**
 * Get list of files from text file
 */
async function readFileList(listPath: string): Promise<string[]> {
  const content = await fs.readFile(listPath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/\\/g, '/')); // Normalize to forward slashes
}

/**
 * Find associated files for a given media file
 * These are files in the same directory with the same base name but different extensions
 */
async function findAssociatedFiles(mediaFilePath: string): Promise<string[]> {
  const dir = path.dirname(mediaFilePath);
  const mediaBasename = path.basename(mediaFilePath);
  const mediaExt = path.extname(mediaBasename).toLowerCase();
  const mediaNameWithoutExt = mediaBasename.slice(0, -mediaExt.length);
  
  const associatedFiles: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      
      const ext = path.extname(entry.name).toLowerCase();
      
      // Skip if it's a video file (those are handled separately)
      if (VALID_VIDEO_EXTENSIONS.includes(ext)) continue;
      
      // Skip if it's not an associated file type we care about
      if (!ASSOCIATED_FILE_EXTENSIONS.includes(ext)) continue;
      
      const entryNameWithoutExt = entry.name.slice(0, -ext.length);
      
      // Check if the base name matches or starts with the media file's base name
      // This handles cases like "movie.srt", "movie.en.srt", "movie-poster.jpg"
      if (entryNameWithoutExt === mediaNameWithoutExt || 
          entryNameWithoutExt.startsWith(mediaNameWithoutExt + '.') ||
          entryNameWithoutExt.startsWith(mediaNameWithoutExt + '-')) {
        associatedFiles.push(path.join(dir, entry.name));
      }
    }
  } catch {
    // Directory read failures can occur for missing directories or permission issues
    // when using --list mode with paths that no longer exist - gracefully return empty
  }
  
  return associatedFiles;
}

/**
 * Generate new path for an associated file based on the primary file's rename
 */
function generateAssociatedFilePath(
  associatedFile: string, 
  originalMediaFile: string, 
  newMediaPath: string
): string {
  const originalDir = path.dirname(originalMediaFile);
  const newDir = path.dirname(newMediaPath);
  
  const originalMediaBasename = path.basename(originalMediaFile);
  const originalMediaExt = path.extname(originalMediaBasename);
  const originalMediaName = originalMediaBasename.slice(0, -originalMediaExt.length);
  
  const newMediaBasename = path.basename(newMediaPath);
  const newMediaExt = path.extname(newMediaBasename);
  const newMediaName = newMediaBasename.slice(0, -newMediaExt.length);
  
  const associatedBasename = path.basename(associatedFile);
  
  // Replace the original media name prefix with the new media name
  let newAssociatedName: string;
  if (associatedBasename.startsWith(originalMediaName)) {
    newAssociatedName = newMediaName + associatedBasename.slice(originalMediaName.length);
  } else {
    // Fallback: just use the original associated filename
    newAssociatedName = associatedBasename;
  }
  
  return path.join(newDir, newAssociatedName);
}

/**
 * Run dry mode and generate renames.txt
 */
export async function runDryMode(options: DryModeOptions): Promise<void> {
  console.log('Running in dry mode...');
  
  let files: string[];
  if (options.fs) {
    console.log(`Enumerating files in: ${options.fs}`);
    files = await enumerateFiles(options.fs);
    console.log(`Found ${files.length} media files`);
  } else if (options.list) {
    console.log(`Reading file list from: ${options.list}`);
    files = await readFileList(options.list);
    console.log(`Found ${files.length} files in list`);
  } else {
    throw new Error('Either --fs or --list is required');
  }

  const renames: Array<{ from: string; to: string }> = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] Processing: ${file}`);
    
    // Try static parsing first
    let mediaInfo: MediaInfo | null = parseFilename(file);
    
    // If static parsing fails, use OpenAI
    if (!mediaInfo) {
      console.log('  → Static parsing failed, using OpenAI...');
      mediaInfo = await parseFilenameWithAI(file, options.apiKey);
    }
    
    if (!mediaInfo) {
      console.log('  → Could not parse filename, skipping');
      continue;
    }
    
    // Validate TV show has required fields
    if (mediaInfo.type === 'tv') {
      if (mediaInfo.season === undefined || mediaInfo.episode === undefined) {
        console.log('  → Invalid TV show data (missing season/episode), skipping');
        continue;
      }
    }
    
    // Generate new path based on the original file's directory
    const originalDir = path.dirname(file);
    const newPath = generateNewPath(mediaInfo, originalDir);
    
    console.log(`  → ${mediaInfo.type === 'tv' ? 'TV Show' : 'Movie'}: ${mediaInfo.title}`);
    if (mediaInfo.type === 'tv') {
      console.log(`  → Season ${mediaInfo.season}, Episode ${mediaInfo.episode}`);
    } else if (mediaInfo.year) {
      console.log(`  → Year: ${mediaInfo.year}`);
    }
    console.log(`  → New path: ${newPath}`);
    
    renames.push({
      from: file,
      to: newPath,
    });
    
    // Find and include associated files
    const associatedFiles = await findAssociatedFiles(file);
    for (const associatedFile of associatedFiles) {
      const newAssociatedPath = generateAssociatedFilePath(associatedFile, file, newPath);
      console.log(`  → Associated file: ${path.basename(associatedFile)} → ${path.basename(newAssociatedPath)}`);
      renames.push({
        from: associatedFile,
        to: newAssociatedPath,
      });
    }
  }
  
  // Write renames.txt
  const outputLines: string[] = [];
  for (const rename of renames) {
    outputLines.push(`-${rename.from}`);
    outputLines.push(`+${rename.to}`);
  }
  
  const outputPath = 'renames.txt';
  await fs.writeFile(outputPath, outputLines.join('\n') + '\n', 'utf-8');
  
  console.log(`\nGenerated ${renames.length} renames in ${outputPath}`);
}
