import { MarlinPort } from './marlin-port';
import { planWind } from './planner';
import { plotGCode } from './plotter';
import { hideBin } from 'yargs/helpers';
import { promises as fs, createWriteStream } from 'fs';
import * as readline from 'readline';

// Looks like using yargs most any other way is kind of broken
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
require('yargs').command({
    command: 'run <file>',
    describe: 'Run a gcode file on the machine',
    builder: {
        port: {
            alias: 'p',
            describe: 'Serial port to connect to',
            demandOption: true,
            type: 'string'
        },
        verbose: {
            alias: 'v',
            describe: 'Log every command?',
            default: false,
            type: 'boolean'
        }
    },
    async handler(argv: Record<string, string>): Promise<void> {
        const marlin = new MarlinPort(argv.port, (argv.verbose as unknown) as boolean);
        const marlinInitialized = marlin.initialize();
        const data = await fs.readFile(argv.file);
        console.log(`Sending commands from "${argv.file}"`);
        await marlinInitialized;

        readline.emitKeypressEvents(process.stdin);

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.on('keypress', (chunk, key) => {
            if (key && key.name === 'space') {
                if (marlin.isPaused()) {
                    console.log('Resuming machine...');
                    return marlin.resume();
                }
                console.log('Pausing machine, press "space" again to resume after it stops');
                marlin.pause();

            }
        });


        for (const command of data.toString().trim().split('\n')) {
            marlin.queueCommand(command);
        }
    }
})
.command({
    command: 'plan <file>',
    describe: 'Generate gcode from a .wind file',
    builder: {
        output: {
            alias: 'o',
            describe: 'File to output to',
            demandOption: false,
            type: 'string'
        },
        verbose: {
            alias: 'v',
            describe: 'Include comments explaining segmented moves?',
            default: false,
            type: 'boolean'
        }
    },
    async handler(argv: Record<string, string>): Promise<void> {
        const fileContents = await fs.readFile(argv.file, "binary");
        const windDefinition = JSON.parse(fileContents);
        // Todo: Verify contents
        const windCommands = planWind(windDefinition, (argv.verbose as unknown) as boolean);
        await fs.writeFile(argv.output, windCommands.join('\n'));
        console.log(`Wrote ${windCommands.length} commands to "${argv.output}"`);
    }
})
.command({
    command: 'plot <file>',
    describe: 'Visualize the contents of a gcode file',
    builder: {
        output: {
            alias: 'o',
            describe: 'PNG file to output to',
            demandOption: true,
            type: 'string'
        }
    },
    async handler(argv: Record<string, string>): Promise<void> {
        const fileContents = await fs.readFile(argv.file, "binary");
        const stream = plotGCode(fileContents.split('\n'));
        if (typeof stream === 'undefined') {
            console.log('No image to write');
            return void 0;
        }
        const outputFile = createWriteStream(argv.output);
        stream.pipe(outputFile);
        outputFile.on('finish', () => console.log(`The PNG file was created at ${argv.output}`));
    }
})
.help()
.parse(hideBin(process.argv));
