import { MarlinPort } from './marlin-port';
import { planWind } from './planner';
import { plotGCode } from './plot';
import { hideBin } from 'yargs/helpers';
import { promises as fs, createWriteStream } from 'fs';

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
        }
    },
    async handler(argv: Record<string, string>) {
        const marlin = new MarlinPort(argv.port);
        const marlinInitialized = marlin.initialize();
        const data = await fs.readFile(argv.file);
        console.log(`Sending commands from "${argv.file}"`);
        await marlin;
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
        }
    },
    async handler(argv: Record<string, string>) {
        const fileContents = await fs.readFile(argv.file, "binary");
        const windDefinition = JSON.parse(fileContents);
        // Todo: Verify contents
        const windCommands = planWind(windDefinition);
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
    async handler(argv: Record<string, string>) {
        const fileContents = await fs.readFile(argv.file, "binary");
        const stream = plotGCode(fileContents.split('\n'));
        const outputFile = createWriteStream(argv.output);
        stream.pipe(outputFile);
        outputFile.on('finish', () => console.log(`The PNG file was created at ${argv.output}`));
    }
})
.help()
.parse(hideBin(process.argv));
