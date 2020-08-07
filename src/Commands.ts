import * as fs from 'fs';
import * as path from 'path';
import * as Code from 'vscode';
import { TFunction } from 'i18next';
import { find as _find, partial as _partial, trim as _trim, without as _without } from 'lodash';

import Debug from './Debug';
import QuickPick from '~/QuickPick';
import FigletBanner from '~/FigletBanner';
import Config, { Settings, DefinedSettings } from '~/Config';

export type CommandList = Record<string, (...args: any[]) => any>;

export default class Commands {
    /**
     * The parent extension.
     */
    private extension: FigletBanner;

    private debug: Debug;

    private i18n: TFunction;

    private quickPick: QuickPick;

    private get config(): Config {
        return this.extension.config;
    }

    /**
     * An object where the keys correspond to a command name *(without
     * namespace)* and the command method.
     */
    private get commandList(): CommandList {
        //> Removed commands from package.json
        /*
            {
                "command": "figlet-banner.AddCurrentFontToFavorites",
                "title": "Figlet Banner: Quick Add Current Default Font To Favorites"
            },
            {
                "command": "figlet-banner.AddCustomFont",
                "title": "Figlet Banner: Add custom font"
            },
            {
                "command": "figlet-banner.RemoveCustomFont",
                "title": "Figlet Banner: Remove custom font"
            },
         */
        return {
            /* eslint-disable @typescript-eslint/unbound-method */
            Apply: this.apply,
            ApplyFromList: this.applyFromList,
            ApplyFromFavorites: _partial(this.applyFromList, true),
            ApplyFromConfig: this.applyFromConfig,
            SetDefaultFont: this.setDefaultFont,
            SetDefaultFontFromFavorites: _partial(this.setDefaultFont, true),
            AddFontToFavorites: this.addFontToFavorites,
            // AddCurrentFontToFavorites: this.addCurrentFontToFavorites,
            RemoveFontFromFavorites: this.removeFromFavorites,
            // AddCustomFont: this.addCustomFont,
            // RemoveCustomFont: this.removeCustomFont,
            AddNewConfig: this.addNewConfig,
            TestAllFonts: this.testFonts,
            TestFavoriteFonts: _partial(this.testFonts, true),
            /* eslint-enable @typescript-eslint/unbound-method */
        };
    }

    constructor(extension: FigletBanner) {
        this.extension = extension;
        this.debug = new Debug(extension);
        this.i18n = this.extension.i18n.getFixedT(null, 'command');
        this.quickPick = new QuickPick(extension);
    }

    /**
     * Register all of the extension's commands.
     */
    public register(): void {
        this.debug.debug('Registering commands...');

        Object.entries(this.commandList).forEach((args) => this.registerCommand(...args));
    }

    /**
     * Register a command for the extension.
     */
    private registerCommand(name: string, method: (...args: any[]) => any): void {
        this.debug.debug(`Command registered: '${name}'.`);

        const disposable = Code.commands.registerCommand(
            `${this.extension.namespace}.${name}`,
            method,
            this
        );

        this.extension.context.subscriptions.push(disposable);
    }

    private notImplemented(): void {
        void Code.window.showInformationMessage('Command Not Implemented Yet!');
    }

    /**
     * Apply using defaults in settings
     */
    private apply(): void {
        const config = this.extension.config.getDefaultConfig(true);

        void this.extension.applyToEditor(config);
    }

    /**
     * Apply default config after picking font from full list or favorites.
     */
    private async applyFromList(fromFavorites = false): Promise<void> {
        const font = fromFavorites
            ? await this.quickPick.chooseFavorite()
            : await this.quickPick.chooseFont();

        if (font !== undefined) {
            if (fromFavorites && !this.extension.isFontLoaded(font)) {
                void Code.window.showErrorMessage(this.i18n('error:fontNotLoaded', { font }));
                return;
            }

            const config = this.config.getDefaultConfig(true);

            config.figletConfig.font = font;

            void this.extension.applyToEditor(config);
        }
    }

    /**
     * Apply after picking config from settings or apply using shortcut with
     * `geddski.macros`.
     */
    private async applyFromConfig(name?: string): Promise<void> {
        const languageId = this.extension.activeTextEditor?.document.languageId;
        const settings = this.config.settings;
        const configs = settings.get<Settings['configs']>('configs') ?? [];
        const defaultFont = settings.get<string>('font');

        if (name) {
            const config = _find(configs, { name });

            if (config !== undefined && languageId !== undefined) {
                config.languageId = languageId;

                void this.extension.applyToEditor(this.config.formatConfigFromSettings(config));
            } else {
                void Code.window.showInformationMessage(this.i18n('info:configNotFound', { name }));
            }

            return;
        }

        const items: Code.QuickPickItem[] = configs.map<Code.QuickPickItem>((config) => {
            const font = config.font ?? defaultFont ?? 'Default';
            return {
                label: config.name,
                description: this.i18n('quickPick:fromConfig', { font }),
                detail: config.description,
            };
        });

        const selectedPickerItem = await Code.window.showQuickPick(items);

        if (selectedPickerItem !== undefined && languageId !== undefined) {
            const config = _find(configs, { name: selectedPickerItem.label }) as DefinedSettings;

            config.languageId = languageId;

            void this.extension.applyToEditor(this.config.formatConfigFromSettings(config));
        }
    }

    /**
     * Change default font
     */
    private async setDefaultFont(fromFavorites = false): Promise<void> {
        const font = fromFavorites
            ? await this.quickPick.chooseFavorite()
            : await this.quickPick.chooseFont();

        if (font !== undefined) {
            void this.config.settings.update('font', font, true);
        }
    }

    /**
     * Add a font to favorites list.
     */
    private async addFontToFavorites(): Promise<void> {
        const font = await this.quickPick.chooseFont();

        if (font !== undefined) {
            const favoriteFonts = this.config.settings.get<string[]>('favorites') ?? [];

            if (!favoriteFonts.includes(font)) {
                favoriteFonts.push(font);

                void this.config.settings.update('favorites', favoriteFonts, true);
            } else {
                void Code.window.showInformationMessage(
                    this.i18n('info:fontInFavorites', { font })
                );
            }
        }
    }

    /**
     * Add current default font to favorites list.
     */
    private addCurrentFontToFavorites(): void {
        const font = this.config.settings.get<string>('font');
        const favoriteFonts = this.config.settings.get<string[]>('favorites') ?? [];

        if (font !== undefined && !favoriteFonts.includes(font)) {
            favoriteFonts.push(font);
            void this.config.settings.update('favorites', favoriteFonts, true);
        } else {
            void Code.window.showInformationMessage(
                this.i18n('info:fontInFavorites', { font, context: 'current' })
            );
        }
    }

    /**
     * Removed font from favorites list.
     */
    private async removeFromFavorites(): Promise<void> {
        const favoriteFonts = this.config.settings.get<string[]>('favorites') ?? [];

        if (!favoriteFonts.length) {
            void Code.window.showInformationMessage(this.i18n('info:fontNotInFavorites'));
            return;
        }

        const font = await this.quickPick.chooseFavorite();

        if (font !== undefined) {
            void this.config.settings.update('favorites', _without(favoriteFonts, font), true);
        }
    }

    /**
     * Add font to custom list.
     */
    // TODO: Consider removing and just use settings.
    private async addCustomFont(): Promise<void> {
        let pathInput = path.normalize(
            _trim(
                await Code.window.showInputBox({
                    placeHolder: this.i18n('addCustomFont.placeHolder'),
                })
            )
        );

        if (pathInput.length <= 0) return;

        if (!pathInput.includes('.flf')) {
            void Code.window.showErrorMessage(this.i18n('error:pathNotFlf'));
            return;
        }

        if (pathInput.startsWith('~') && process.env.HOME) {
            pathInput = path.join(process.env.HOME, pathInput.slice(1));
        }

        if (!fs.existsSync(pathInput)) {
            void Code.window.showErrorMessage(
                this.i18n('error:fileDoesNotExist', { file: pathInput })
            );
            return;
        } else {
            const customFonts = this.config.settings.get<string[]>('customFonts') ?? [];

            if (customFonts.includes(pathInput)) {
                void Code.window.showInformationMessage(this.i18n('info:customFontExists'));
                return;
            }

            customFonts.push(pathInput);

            try {
                void this.config.settings.update('customFonts', customFonts, true);
            } catch (error) {
                void Code.window.showErrorMessage(this.i18n('error:settingsUpdateFailed'));
            }
        }
    }

    /**
     * Remove font from custom list.
     */
    private async removeCustomFont(): Promise<void> {
        const customFonts = this.config.settings.get<string[]>('customFonts') ?? [];

        if (!customFonts.length) {
            void Code.window.showInformationMessage(this.i18n('info:noCustomFontsSaved'));
            return;
        }

        const font = await this.quickPick.chooseCustomFont();

        if (!font) return;

        void this.config.settings.update('customFonts', _without(customFonts, font), true);
    }

    private addNewConfig(): void {
        void this.quickPick.generateNewConfig();
    }

    // FIXME: Add a proggress indicator!
    private async testFonts(fromFavorites = false): Promise<void> {
        const fonts = fromFavorites
            ? this.config.settings.get<string[]>('favorites') ?? []
            : (this.extension.figlet.fontsSync() as string[]);
        const editor = this.extension.activeTextEditor;
        const config = this.config.getDefaultConfig(true);

        const applied =
            (await editor?.edit((builder) => {
                fonts.forEach((font) => {
                    const fontConfig = Object.assign({}, config);
                    fontConfig.figletConfig.font = font;
                    const bannerText = this.extension.generateBannerComment(font, config);

                    builder.insert(
                        editor.selection.active,
                        `${config.commentConfig?.lineComment ?? '//'} ${font}\n`
                    );
                    builder.insert(editor.selection.active, (bannerText ?? '') + '\n\n');
                });
            })) ?? false;

        if (!applied) {
            void Code.window.showErrorMessage(this.i18n('error:cantCreateBanner'));
        }
    }
}
