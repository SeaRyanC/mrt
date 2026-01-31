import OpenAI from 'openai';
import { MediaInfo, VALID_VIDEO_EXTENSIONS } from './parser';
import path from 'path';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

/**
 * Validate API key format
 */
function validateApiKey(apiKey: string): boolean {
  return apiKey !== undefined && apiKey.length > 10;
}

/**
 * Zod schema for TV show response
 */
const TVShowSchema = z.object({
  type: z.literal('tv'),
  title: z.string(),
  season: z.number(),
  episode: z.number(),
  episodeTitle: z.string().optional(),
});

/**
 * Zod schema for movie response
 */
const MovieSchema = z.object({
  type: z.literal('movie'),
  title: z.string(),
  year: z.number().optional(),
});

/**
 * Zod schema for unknown response
 */
const UnknownSchema = z.object({
  type: z.literal('unknown'),
});

/**
 * Combined schema for all response types
 */
const MediaParseSchema = z.discriminatedUnion('type', [
  TVShowSchema,
  MovieSchema,
  UnknownSchema,
]);

/**
 * Use OpenAI to parse filename when static parsing fails
 */
export async function parseFilenameWithAI(
  filepath: string,
  apiKey: string
): Promise<MediaInfo | null> {
  if (!validateApiKey(apiKey)) {
    throw new Error('Invalid OpenAI API key provided');
  }

  const openai = new OpenAI({ apiKey });
  const basename = path.basename(filepath);
  const rawExtension = path.extname(basename);
  // Only treat it as a file extension if it's a valid video extension
  const extension = VALID_VIDEO_EXTENSIONS.includes(rawExtension.toLowerCase()) ? rawExtension : '';

  const prompt = `Analyze this media filename and extract structured information: "${basename}"

Please determine:
1. Is this a TV show or a movie?
2. What is the title (properly capitalized)?
3. For TV shows: What is the season number and episode number? What is the episode title if available?
4. For movies: What is the release year if available?

If you cannot determine with confidence, respond with type "unknown".`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes media filenames and extracts structured information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: zodResponseFormat(MediaParseSchema, 'media_parse'),
      temperature: 0,
    });

    // Check if content exists
    const content = response.choices[0].message.content;
    if (!content) {
      console.error('OpenAI response has no content');
      return null;
    }

    // Parse the response using Zod
    const parsed = MediaParseSchema.safeParse(JSON.parse(content));

    // Check if parsing failed
    if (!parsed.success) {
      console.error('Failed to parse OpenAI response:', parsed.error);
      return null;
    }

    const result = parsed.data;

    // Check if returned unknown
    if (result.type === 'unknown') {
      return null;
    }

    const mediaInfo: MediaInfo = {
      type: result.type,
      title: result.title,
      extension,
      originalPath: filepath,
    };

    if (result.type === 'tv') {
      mediaInfo.season = result.season;
      mediaInfo.episode = result.episode;
      mediaInfo.episodeTitle = result.episodeTitle;
    } else if (result.type === 'movie') {
      mediaInfo.year = result.year;
    }

    return mediaInfo;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error parsing filename with OpenAI: ${errorMsg}`);
    return null;
  }
}
