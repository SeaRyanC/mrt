import fs from 'fs/promises';
import path from 'path';
import { parseFilename, generateNewPath, MediaInfo } from './parser';
import { parseFilenameWithAI } from './openai-parser';

interface DryModeOptions {
  apiKey: string;
  fs?: string;
  list?: string;
}

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
        if (['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.ts'].includes(ext)) {
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
