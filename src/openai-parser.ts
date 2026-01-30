import OpenAI from 'openai';
import { MediaInfo } from './parser';
import path from 'path';

/**
 * Use OpenAI to parse filename when static parsing fails
 */
export async function parseFilenameWithAI(
  filepath: string,
  apiKey: string
): Promise<MediaInfo | null> {
  const openai = new OpenAI({ apiKey });
  const basename = path.basename(filepath);
  const extension = path.extname(basename);

  const prompt = `Analyze this media filename and extract structured information: "${basename}"

Please determine:
1. Is this a TV show or a movie?
2. What is the title (properly capitalized)?
3. For TV shows: What is the season number and episode number? What is the episode title if available?
4. For movies: What is the release year if available?

Respond in JSON format:
{
  "type": "tv" or "movie",
  "title": "Title in Proper Case",
  "season": number (TV only),
  "episode": number (TV only),
  "episodeTitle": "Episode Title" (TV only, optional),
  "year": number (movie only, optional)
}

If you cannot determine with confidence, respond with {"type": "unknown"}`;

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
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    if (result.type === 'unknown' || !result.type) {
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
    console.error(`Error parsing filename with OpenAI: ${error}`);
    return null;
  }
}
