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
```

### Wet Mode

Wet mode reads `renames.txt` and performs the actual file renames:

```bash
mrt --wet renames.txt
```

## Naming Conventions

The tool follows Plex naming conventions:

### TV Shows
```
ShowName/Season 01/ShowName - S01E01 - Episode Title.ext
```

### Movies
```
MovieName (Year)/MovieName (Year).ext
```

## Requirements

- Node.js 20+
- OpenAI API key (for dry mode)
- Supported video formats: .mkv, .mp4, .avi, .mov, .wmv, .flv, .m4v, .ts

## References

- [Plex Movie Naming](https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/)
- [Plex TV Show Naming](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)