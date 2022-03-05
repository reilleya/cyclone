import { SerialPort, ReadlineParser } from 'serialport';
import { isObject } from './helpers';

export class MarlinPort {
    
    private isInitialized = false;
    private port: SerialPort;
    private parser: ReadlineParser;

    private commandQueue: string[] = [];
    private hasCommandWaiting = false;

    constructor( private portPath: string, private baudRate = 115200 ) {

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

    private processSerialResponseLine(line: string): void {
        if ( line === 'ok' ) {
            this.hasCommandWaiting = false; 
            this.tryNextCommand();
            return void 0;
        }

        console.log(`Got back '${line}'`);
        return void 0;
    }

    private tryNextCommand(): void {
        if (this.hasCommandWaiting || this.commandQueue.length === 0) {
            return void 0;
        }
        const commandToSend = this.commandQueue.shift();
        console.log(`Sending "${commandToSend}"`);
        this.hasCommandWaiting = true;
        this.port.write(`${commandToSend}\n`);
    }
}
