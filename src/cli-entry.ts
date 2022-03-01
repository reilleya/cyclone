import { Machine } from './machine';
import { hideBin } from 'yargs/helpers';
import { promises as fs } from "fs";

// Looks like using yargs most any other way is kind of broken
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
require('yargs').command({
    command: 'run <file>',
    describe: 'Run a gcode file on the machine',
    builder: {
        port: {
            describe: 'Serial port to connect to',
            demandOption: true,
            type: 'string'
        }
    },
    async handler(argv: Record<string, string>) {
        const machine = new Machine(argv.port);
        const machineInitialized = machine.initialize();
        const data = await fs.readFile(argv.file);
        console.log(`Sending commands from "${argv.file}"`);
        await machineInitialized;
        for (const command of data.toString().trim().split('\n')) {
            machine.queueCommand(command);
        }
    }
})
.help()
.parse(hideBin(process.argv));
