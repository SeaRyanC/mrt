import path from 'path';

/**
 * Valid video file extensions
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
 * Generate the new path based on media info
 */
export function generateNewPath(info: MediaInfo, basePath: string): string {
  const relativeNewPath = info.type === 'tv' 
    ? generateTVFilename(info)
    : generateMovieFilename(info);
  
  return path.join(basePath, relativeNewPath);
}
