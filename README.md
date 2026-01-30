# mrt - Media Renaming Tool

A Node.js TypeScript CLI tool for automatically renaming media files to follow Plex naming conventions.

## Features

- Automatically parses media filenames to extract show/movie information
- Supports both TV shows and movies
- Uses OpenAI API for ambiguous filenames
- Follows Plex naming conventions for organized media libraries
- Safe dry-run mode before performing renames
- Supports both filesystem enumeration and file list input

## Installation

```bash
npm install
npm run build
```

## Usage

### Dry Mode

Dry mode analyzes files and generates a `renames.txt` file with proposed renames:

```bash
# Enumerate files in a folder
mrt --key YOUR_OPENAI_API_KEY --dry --fs /path/to/media

# Use a list of files
mrt --key YOUR_OPENAI_API_KEY --dry --list files.txt
```

The `renames.txt` output format:
```
-/media/TV/Foo.S01e02 The Big Bar AMZN WebRIP 1080p.mkv
+/media/TV/Foo/Season 01/Foo - S01E02 - The Big Bar.mkv
-/media/Movies/Inception.2010.BluRay.1080p.mkv
+/media/Movies/Inception (2010)/Inception (2010).mkv
```

### Wet Mode

Wet mode reads `renames.txt` and performs the actual file renames:

```bash
mrt --wet renames.txt
```

## Example Workflow

1. Create a list of files or point to a directory:
```bash
# Option 1: Use filesystem enumeration
mrt --key sk-abc123... --dry --fs /media/downloads

# Option 2: Create a file list
echo "/media/TV/Breaking.Bad.S01E01.Pilot.mkv" > files.txt
echo "/media/Movies/The.Matrix.1999.BluRay.mkv" >> files.txt
mrt --key sk-abc123... --dry --list files.txt
```

2. Review the generated `renames.txt` file

3. Execute the renames:
```bash
mrt --wet renames.txt
```

## Naming Conventions

The tool follows Plex naming conventions:

### TV Shows
```
ShowName/Season 01/ShowName - S01E01 - Episode Title.ext
```

Example transformations:
- `Breaking.Bad.S01E01.Pilot.1080p.mkv` → `Breaking Bad/Season 01/Breaking Bad - S01E01 - Pilot.mkv`
- `Friends.S05e10.The.One.mkv` → `Friends/Season 05/Friends - S05E10 - The One.mkv`

### Movies
```
MovieName (Year)/MovieName (Year).ext
```

Example transformations:
- `The.Matrix.1999.BluRay.mkv` → `The Matrix (1999)/The Matrix (1999).mkv`
- `Inception.2010.IMAX.1080p.mp4` → `Inception (2010)/Inception (2010).mp4`

## How It Works

1. **Static Parsing**: The tool first attempts to parse filenames using regex patterns for common formats (S01E01, year patterns, etc.)

2. **OpenAI Fallback**: If static parsing fails or produces low-confidence results, the tool uses OpenAI's API to intelligently parse the filename

3. **Metadata Removal**: All quality indicators (1080p, BluRay, AMZN, etc.) are removed from the final filename to keep it clean

4. **Directory Structure**: Files are automatically organized into proper directories (Season folders for TV shows, movie title folders for movies)

## Requirements

- Node.js 20+
- OpenAI API key (for dry mode)
- Supported video formats: .mkv, .mp4, .avi, .mov, .wmv, .flv, .m4v, .ts

## References

- [Plex Movie Naming](https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/)
- [Plex TV Show Naming](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)