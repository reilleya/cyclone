import { SerialPort, ReadlineParser } from 'serialport';
import { isObject } from './helpers';

export class MarlinPort {
    
    private isInitialized = false;
    private port: SerialPort;
    private parser: ReadlineParser;

    private commandQueue: string[] = [];
    private hasCommandWaiting = false;

    private pausing = false;
    private paused = false;
    private resuming = false;

    constructor( private portPath: string, private verbose = false, private baudRate = 115200 ) {

    }

    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return void 0;
        }

        this.hasCommandWaiting = false;

        this.port = new SerialPort({
          path: this.portPath,
          baudRate: this.baudRate,
          autoOpen: false
        });

        // TODO: .off this in reset
        this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }))
        this.parser.on('data', (line) => {
            this.processSerialResponseLine(line)
        });

        return new Promise((resolve, reject) => {
            console.log(`Opening "${this.portPath}" at ${this.baudRate} baud`);
            this.port.open((error) => {
              if (isObject(error)) {
                return reject(`Error opening port: ${error.message}`);
              }
              console.log('Port opened.\n');
              this.isInitialized = true;
              this.tryNextCommand();
              resolve();
            })
        });
    }

    public reset(): void {
        this.hasCommandWaiting = false;
        this.commandQueue = [];

        this.isInitialized = false;
        return void 0;
    }

    public queueCommand(line: string): void {
        this.commandQueue.push(line);
        this.tryNextCommand();
    }

    public pause(): void {
        if (this.paused || this.pausing || this.resuming) {
            console.log('Cannot pause when already paused or resuming!');
            return void 0;
        }
        this.pausing = true;
        this.writeCommand('M0');
    }

    public completePause(): void {
        this.pausing = false;
        this.paused = true;
        console.log('Machine paused.')
    }

    public isPaused(): boolean {
        return this.paused || this.pausing;
    }

    public resume(): void {
        if (!this.paused || this.resuming) {
            console.log('Cannot resume when already resuming or not paused!');
            return void 0;
        }
        this.resuming = true;
        this.writeCommand('M108');
    }

    public completeResume(): void {
        if (!this.paused || !this.resuming) {
            console.log('Cannot complete resume while not paused or resuming!');
            return void 0;
        }
        this.pausing = false;
        this.paused = false;
        this.resuming = false;
        this.tryNextCommand();
    }

    private processSerialResponseLine(line: string): void {
        if ( line === 'ok' ) {
            this.hasCommandWaiting = false; 
            this.tryNextCommand();
            return void 0;
        }

        if ( line === 'echo:busy: processing' || line == 'echo:busy: paused for user' ) {
            return void 0;
        }

        if ( line === '//action:notification Click to Resume...') {
            this.completePause();
            return void 0;
        }

        if ( line === '//action:notification 3D Printer Ready.') {
            if (!this.resuming) {
                console.log('Saw resume response while not resuming!');
                return void 0;
            }
            this.completeResume();
            return void 0;
        }

        console.log(`Got back unexpected response '${line}'`);
        return void 0;
    }

    private tryNextCommand(): void {
        if (this.hasCommandWaiting || this.commandQueue.length === 0 || this.paused) {
            return void 0;
        }
        const commandToSend = this.commandQueue.shift();
        // Check for comments
        if (commandToSend.slice(0, 1) === ';') {
            console.log(commandToSend.slice(1).trim())
            return this.tryNextCommand();
        }
        if (this.verbose) {
            console.log(`Sending "${commandToSend}"`);
        }
        this.hasCommandWaiting = true;
        this.writeCommand(commandToSend);
    }

    private writeCommand(command: string): void {
        this.port.write(`${command}\n`);
    }
}
