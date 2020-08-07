import * as fs from 'fs';
import * as path from 'path';
import { InitOptions as I18nInitOptions } from 'i18next';
import { I18nextOptions as BackendOptions } from 'i18next-fs-backend';
import Debug from '~/Debug';
import FigletBanner from '~/FigletBanner';

type Config = I18nInitOptions & BackendOptions;

function preload(langDir: string): string[] {
    return fs.readdirSync(langDir).filter((fileName) => {
        const joinedPath = path.join(langDir, fileName);
        const isDirectory = fs.lstatSync(joinedPath).isDirectory();

        return isDirectory;
    });
}

export default function config(extension: FigletBanner): Config {
    const context = extension.context;
    const debug = new Debug(extension);
    const langDir = path.join(context.asAbsolutePath('./lang'));
    const langPath = path.join(langDir, './{{lng}}/{{ns}}.json');
    const opts: Config = {
        debug: debug.isDev,
        initImmediate: false,
        fallbackLng: 'en-US',
        supportedLngs: ['en'],
        defaultNS: 'common',
        ns: ['command', 'common', 'config', 'error', 'info', 'quickPick', 'warning'],
        cleanCode: true,
        nonExplicitSupportedLngs: true,
        preload: preload(langDir),
        returnObjects: true,
        backend: {
            jsonIndent: 4,
            loadPath: langPath,
            addPath: path.join(langDir, './{{lng}}/{{ns}}.missing.json'),
        },
    };

    //> Save Missing Keys
    //! WARNING: Only use in DEV envs !
    if (debug.isDev) {
        opts.saveMissing = true;
        opts.updateMissing = true;
        opts.saveMissingTo = 'all';
    }

    return opts;
}

export { Config };
