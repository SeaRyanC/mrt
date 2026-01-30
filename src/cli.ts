#!/usr/bin/env node

import { Command } from 'commander';
import { runDryMode } from './dry';
import { runWetMode } from './wet';

const program = new Command();

program
  .name('mrt')
  .description('Media Renaming Tool - Automatically rename media files to follow Plex conventions')
  .version('1.0.0');

// Dry mode command
program
  .option('--key <apikey>', 'OpenAI API key (required for dry mode)')
  .option('--dry', 'Run in dry mode (generate renames.txt)')
  .option('--fs <path>', 'Enumerate files in the given folder')
  .option('--list <file>', 'Read list of files from the given text file')
  .option('--wet <file>', 'Run in wet mode (execute renames from file)')
  .action(async (options) => {
    if (options.wet) {
      // Wet mode
      await runWetMode(options.wet);
    } else if (options.dry) {
      // Dry mode
      if (!options.key) {
        console.error('Error: --key is required for dry mode');
        process.exit(1);
      }
      if (!options.fs && !options.list) {
        console.error('Error: Either --fs or --list is required for dry mode');
        process.exit(1);
      }
      if (options.fs && options.list) {
        console.error('Error: Cannot use both --fs and --list');
        process.exit(1);
      }
      await runDryMode({
        apiKey: options.key,
        fs: options.fs,
        list: options.list,
      });
    } else {
      console.error('Error: Either --dry or --wet is required');
      program.help();
    }
  });

program.parse(process.argv);
