import { Client, ClientOptions, Collection } from 'discord.js';
import { CommandModule } from './command-interface';

export class KuruttinaClient extends Client {
  public commands: Collection<string, CommandModule> = new Collection();

  constructor(options: ClientOptions) {
    super(options);
  }
}
