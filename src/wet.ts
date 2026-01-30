import fs from 'fs/promises';
import path from 'path';

interface Rename {
  from: string;
  to: string;
}

/**
 * Parse renames.txt file
 */
async function parseRenamesFile(filepath: string): Promise<Rename[]> {
  const content = await fs.readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  const renames: Rename[] = [];
  let currentFrom: string | null = null;
  let lineNum = 0;
  
  for (const line of lines) {
    lineNum++;
    if (line.startsWith('-')) {
      if (currentFrom !== null) {
        console.warn(`Warning: Line ${lineNum}: Found consecutive '-' lines without '+' line`);
      }
      currentFrom = line.slice(1);
    } else if (line.startsWith('+')) {
      if (currentFrom) {
        renames.push({
          from: currentFrom,
          to: line.slice(1),
        });
        currentFrom = null;
      } else {
        console.warn(`Warning: Line ${lineNum}: Found '+' line without preceding '-' line`);
      }
    } else {
      console.warn(`Warning: Line ${lineNum}: Invalid line format (should start with '-' or '+')`);
    }
  }
  
  if (currentFrom !== null) {
    console.warn(`Warning: Found '-' line at end of file without matching '+' line`);
  }
  
  return renames;
}

/**
 * Ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // Only ignore EEXIST errors
    if (err.code !== 'EEXIST') {
      const errorMsg = err.message || String(error);
      console.warn(`Warning: Could not create directory ${dirPath}: ${errorMsg}`);
      throw error;
    }
  }
}

/**
 * Run wet mode and execute renames
 */
export async function runWetMode(renamesFile: string): Promise<void> {
  console.log('Running in wet mode...');
  console.log(`Reading renames from: ${renamesFile}`);
  
  const renames = await parseRenamesFile(renamesFile);
  console.log(`Found ${renames.length} renames to execute`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < renames.length; i++) {
    const rename = renames[i];
    console.log(`\n[${i + 1}/${renames.length}]`);
    console.log(`  From: ${rename.from}`);
    console.log(`  To:   ${rename.to}`);
    
    try {
      // Check if source file exists
      await fs.access(rename.from);
      
      // Ensure destination directory exists
      const destDir = path.dirname(rename.to);
      await ensureDir(destDir);
      
      // Check if destination already exists
      try {
        await fs.access(rename.to);
        console.log(`  ⚠ Destination already exists, skipping`);
        errorCount++;
        continue;
      } catch {
        // Destination doesn't exist, which is good
      }
      
      // Perform the rename
      await fs.rename(rename.from, rename.to);
      console.log(`  ✓ Success`);
      successCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ Error: ${errorMsg}`);
      errorCount++;
    }
  }
  
  console.log(`\nCompleted:`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors:  ${errorCount}`);
}
