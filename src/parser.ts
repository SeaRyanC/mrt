import path from 'path';

/**
 * Valid video file extensions (lowercase only - comparisons should use toLowerCase())
 */
export const VALID_VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.m4v', '.ts'];

export interface MediaInfo {
  type: 'tv' | 'movie';
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  extension: string;
  originalPath: string;
}

/**
 * Attempt to parse a filename statically without AI
 */
export function parseFilename(filepath: string): MediaInfo | null {
  const basename = path.basename(filepath);
  const rawExtension = path.extname(basename);
  // Only treat it as a file extension if it's a valid video extension
  // Otherwise, treat the path as a folder (no extension)
  const extension = VALID_VIDEO_EXTENSIONS.includes(rawExtension.toLowerCase()) ? rawExtension : '';
  const nameWithoutExt = extension ? basename.slice(0, -extension.length) : basename;

  // Try to parse TV show format
  const tvMatch = nameWithoutExt.match(/^(.+?)[\s._-]*[Ss](\d{1,2})[Ee](\d{1,2})(?:[\s._-]*(.+?))?(?:[\s._-]*(AMZN|WebRIP|WEBRip|BluRay|HDTV|1080p|720p|480p).*)?$/i);
  if (tvMatch) {
    return {
      type: 'tv',
      title: cleanTitle(tvMatch[1]),
      season: parseInt(tvMatch[2], 10),
      episode: parseInt(tvMatch[3], 10),
      episodeTitle: tvMatch[4] ? cleanTitle(tvMatch[4]) : undefined,
      extension,
      originalPath: filepath,
    };
  }

  // Try to parse movie format (with year)
  const movieMatch = nameWithoutExt.match(/^(.+?)[\s._-]*\((\d{4})\)/);
  if (movieMatch) {
    return {
      type: 'movie',
      title: cleanTitle(movieMatch[1]),
      year: parseInt(movieMatch[2], 10),
      extension,
      originalPath: filepath,
    };
  }

  // Try to find year in the filename
  const yearMatch = nameWithoutExt.match(/^(.+?)[\s._-]+(\d{4})(?:[\s._-]|$)/);
  if (yearMatch) {
    const yearNum = parseInt(yearMatch[2], 10);
    const currentYear = new Date().getFullYear();
    // Accept years from 1900 to 3 years in the future
    if (yearNum >= 1900 && yearNum <= currentYear + 3) {
      return {
        type: 'movie',
        title: cleanTitle(yearMatch[1]),
        year: yearNum,
        extension,
        originalPath: filepath,
      };
    }
  }

  return null;
}

/**
 * Clean up title by removing dots, underscores, and extra metadata
 */
function cleanTitle(title: string): string {
  return title
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/[\s-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parse media info from folder context when filename parsing fails.
 * This handles cases like:
 * - /media/Movie Name (2021)/movie.mkv -> extracts "Movie Name" and year 2021
 * - /media/Show Name/Season 01/episode.mkv -> extracts "Show Name" and season 1
 * - /media/Show Name/Season 01/S01E03.mkv -> extracts show name from folder, episode from filename
 */
export function parseFromFolderContext(filepath: string): MediaInfo | null {
  const basename = path.basename(filepath);
  const rawExtension = path.extname(basename);
  const extension = VALID_VIDEO_EXTENSIONS.includes(rawExtension.toLowerCase()) ? rawExtension : '';
  const nameWithoutExt = extension ? basename.slice(0, -extension.length) : basename;
  const parts = filepath.split(path.sep);
  
  // Try to extract episode info from filename (S01E01 format without show name)
  const episodeOnlyMatch = nameWithoutExt.match(/^[Ss](\d{1,2})[Ee](\d{1,2})(?:[\s._-]*(.+?))?(?:[\s._-]*(AMZN|WebRIP|WEBRip|BluRay|HDTV|1080p|720p|480p).*)?$/i);
  
  // Look for Season XX folder pattern
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    const seasonMatch = part.match(/^Season\s+(\d+)$/i);
    
    if (seasonMatch) {
      // Found a season folder, look for show name in parent
      const seasonNum = parseInt(seasonMatch[1], 10);
      
      if (i > 0) {
        const showFolder = parts[i - 1];
        // The show folder should just be the show name (not a Season folder)
        if (!/^Season\s+\d+$/i.test(showFolder)) {
          // Check if we can extract episode number from filename
          if (episodeOnlyMatch) {
            return {
              type: 'tv',
              title: showFolder,
              season: parseInt(episodeOnlyMatch[1], 10),
              episode: parseInt(episodeOnlyMatch[2], 10),
              episodeTitle: episodeOnlyMatch[3] ? cleanTitle(episodeOnlyMatch[3]) : undefined,
              extension,
              originalPath: filepath,
            };
          }
          
          // Try to extract episode number from filename in other formats
          const simpleEpMatch = nameWithoutExt.match(/(?:^|[\s._-])(?:e|ep|episode)?\s*(\d{1,2})(?:[\s._-]|$)/i);
          if (simpleEpMatch) {
            return {
              type: 'tv',
              title: showFolder,
              season: seasonNum,
              episode: parseInt(simpleEpMatch[1], 10),
              extension,
              originalPath: filepath,
            };
          }
          
          // If we can't determine episode, we can't generate a proper TV filename
          // Return null so it can fall through to AI parsing
          return null;
        }
      }
    }
  }
  
  // Look for movie folder pattern: "Movie Name (Year)" or just "Movie Name"
  for (let i = parts.length - 2; i >= 0; i--) {
    const part = parts[i];
    
    // Try to match "Movie Name (Year)" format
    const movieYearMatch = part.match(/^(.+?)\s*\((\d{4})\)$/);
    if (movieYearMatch) {
      const yearNum = parseInt(movieYearMatch[2], 10);
      const currentYear = new Date().getFullYear();
      if (yearNum >= 1900 && yearNum <= currentYear + 3) {
        return {
          type: 'movie',
          title: movieYearMatch[1].trim(),
          year: yearNum,
          extension,
          originalPath: filepath,
        };
      }
    }
    
    // Don't match generic folder names that are likely not movie titles
    // Skip if it looks like a Season folder or other structural folder
    if (/^Season\s+\d+$/i.test(part)) continue;
    
    // If folder has year at end without parentheses, try to extract it
    const folderYearMatch = part.match(/^(.+?)[\s._-]+(\d{4})$/);
    if (folderYearMatch) {
      const yearNum = parseInt(folderYearMatch[2], 10);
      const currentYear = new Date().getFullYear();
      if (yearNum >= 1900 && yearNum <= currentYear + 3) {
        return {
          type: 'movie',
          title: cleanTitle(folderYearMatch[1]),
          year: yearNum,
          extension,
          originalPath: filepath,
        };
      }
    }
  }
  
  return null;
}

/**
 * Generate Plex-compliant filename for TV show
 */
export function generateTVFilename(info: MediaInfo): string {
  if (info.type !== 'tv' || !info.season || !info.episode) {
    throw new Error('Invalid TV show info');
  }

  const seasonNum = info.season.toString().padStart(2, '0');
  const episodeNum = info.episode.toString().padStart(2, '0');
  
  let filename = `${info.title} - S${seasonNum}E${episodeNum}`;
  if (info.episodeTitle) {
    filename += ` - ${info.episodeTitle}`;
  }
  filename += info.extension;

  const dirPath = `${info.title}/Season ${seasonNum}`;
  return path.join(dirPath, filename);
}

/**
 * Generate Plex-compliant filename for movie
 */
export function generateMovieFilename(info: MediaInfo): string {
  if (info.type !== 'movie') {
    throw new Error('Invalid movie info');
  }

  let filename = info.title;
  if (info.year) {
    filename += ` (${info.year})`;
  }
  filename += info.extension;

  // Movies go in their own directory
  const dirPath = info.year ? `${info.title} (${info.year})` : info.title;
  return path.join(dirPath, filename);
}

/**
 * Normalize a string for case-insensitive comparison
 */
function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[\s._-]+/g, ' ').trim();
}

/**
 * Strip trailing year from a string (both "(Year)" and "Year" formats)
 */
function stripTrailingYear(str: string): string {
  return str
    .replace(/\s*\(\d{4}\)\s*$/, '')  // Strip "(2021)" format
    .replace(/\s+\d{4}\s*$/, '')       // Strip "2021" format
    .trim();
}

/**
 * Check if two strings are similar (case-insensitive, ignoring separators)
 * Also considers strings similar if they match when trailing years are stripped
 */
function isSimilar(a: string, b: string): boolean {
  const aNorm = normalizeForComparison(a);
  const bNorm = normalizeForComparison(b);
  
  if (aNorm === bNorm) return true;
  
  // Also check if they match when years are stripped
  const aStripped = normalizeForComparison(stripTrailingYear(a));
  const bStripped = normalizeForComparison(stripTrailingYear(b));
  
  return aStripped === bStripped;
}

/**
 * Detect if a path is already in a proper media folder structure and find the root
 * Returns the "media root" path where Show/Movie folders should be placed
 */
export function findMediaRoot(originalDir: string, info: MediaInfo): string {
  const parts = originalDir.split(path.sep);
  
  if (info.type === 'tv') {
    // For TV shows, look for ShowName/Season XX pattern
    // Walk backwards to find if we're already in a show folder
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      
      // Check if this is a "Season XX" folder
      if (/^Season\s+\d+$/i.test(part)) {
        // Check if the parent folder is the show name
        if (i > 0 && isSimilar(parts[i - 1], info.title)) {
          // Return the grandparent as the media root
          const rootParts = parts.slice(0, i - 1);
          return rootParts.length > 0 ? rootParts.join(path.sep) : parts[0];
        }
      }
      
      // Check if this folder matches the show name (we might be in ShowName directly)
      if (isSimilar(part, info.title)) {
        // Return the parent as the media root
        const rootParts = parts.slice(0, i);
        return rootParts.length > 0 ? rootParts.join(path.sep) : parts[0];
      }
    }
  } else if (info.type === 'movie') {
    // For movies, look for "MovieName (Year)" pattern
    const movieFolder = info.year ? `${info.title} (${info.year})` : info.title;
    
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      
      // Check if this folder matches the movie folder name
      if (isSimilar(part, movieFolder) || isSimilar(part, info.title)) {
        // Return the parent as the media root
        const rootParts = parts.slice(0, i);
        return rootParts.length > 0 ? rootParts.join(path.sep) : parts[0];
      }
    }
  }
  
  // No existing structure found, use the original directory
  return originalDir;
}

/**
 * Detect and fix double-nested folder paths
 * e.g., "Show/Show/Season 01" -> "Show/Season 01"
 */
export function fixDoubleNesting(filePath: string): string {
  const parts = filePath.split(path.sep);
  const result: string[] = [];
  
  for (let i = 0; i < parts.length; i++) {
    const currentPart = parts[i];
    
    // Check for consecutive duplicate folder names (double nesting)
    if (i > 0 && isSimilar(parts[i - 1], currentPart)) {
      // Skip this duplicate folder
      continue;
    }
    
    // Check for pattern like "Show/Show Name/Season" where Show is contained in Show Name
    // or "Show Name/Show Name (Year)" patterns
    if (i > 0) {
      const prevPart = parts[i - 1];
      // If previous part is a prefix of current part (ignoring case and year suffixes)
      const prevNorm = normalizeForComparison(prevPart);
      const currNorm = normalizeForComparison(currentPart.replace(/\s*\(\d{4}\)\s*$/, ''));
      if (prevNorm === currNorm) {
        // Remove the previous entry and add the current (more complete) one
        result.pop();
      }
    }
    
    result.push(currentPart);
  }
  
  return result.join(path.sep);
}

/**
 * Generate the new path based on media info
 */
export function generateNewPath(info: MediaInfo, basePath: string): string {
  const relativeNewPath = info.type === 'tv' 
    ? generateTVFilename(info)
    : generateMovieFilename(info);
  
  // Find the appropriate media root (avoiding double-nesting)
  const mediaRoot = findMediaRoot(basePath, info);
  const fullPath = path.join(mediaRoot, relativeNewPath);
  
  // Fix any remaining double-nesting issues
  return fixDoubleNesting(fullPath);
}
